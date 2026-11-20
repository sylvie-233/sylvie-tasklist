import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';
import started from 'electron-squirrel-startup';

import {
  createSampleTaskData,
  migrateSettings,
  migrateTaskData,
  nextNewOrder,
  serializeSettings,
  UNGROUPED,
} from '@sylvie/core';
import type { AppSettings, Task, TaskData, TaskDraft } from '@sylvie/core';

import type { AppInfo, AppPaths, FileOpResult, LoadResult, McpStatus } from './desktop-types';
import { attachDevCapture } from './dev-capture';
import { startMcpServer, type McpServerHandle } from './mcp-server';

const TASKS_FILE = 'tasks.json';
const SETTINGS_FILE = 'settings.json';
const MCP_DEFAULT_PORT = 37821;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let tasksCache: TaskData | null = null;
let settingsCache: AppSettings | null = null;
let mcpHandle: McpServerHandle | null = null;
let mcpError: string | undefined;

function getPaths(): AppPaths {
  const dataDir = app.getPath('userData');
  return {
    dataDir,
    tasksPath: path.join(dataDir, TASKS_FILE),
    settingsPath: path.join(dataDir, SETTINGS_FILE),
  };
}

function getInfo(): AppInfo {
  return {
    version: app.getVersion(),
    platform: process.platform,
    paths: getPaths(),
  };
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as unknown;
  } catch {
    // 文件不存在或内容损坏：交给调用方降级处理
    return null;
  }
}

/** 原子写入：先写临时文件再 rename，避免中途崩溃写坏数据。 */
async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

async function ensureTasksLoaded(): Promise<TaskData> {
  if (tasksCache) {
    return tasksCache;
  }
  const { tasksPath } = getPaths();
  const raw = await readJsonFile(tasksPath);
  if (raw === null) {
    // 首次启动：写入示例数据，方便直接体验交互
    tasksCache = createSampleTaskData();
    await writeJsonAtomic(tasksPath, tasksCache);
    return tasksCache;
  }
  tasksCache = migrateTaskData(raw);
  await writeJsonAtomic(tasksPath, tasksCache);
  return tasksCache;
}

async function ensureSettingsLoaded(): Promise<AppSettings> {
  if (settingsCache) {
    return settingsCache;
  }
  const { settingsPath } = getPaths();
  const raw = await readJsonFile(settingsPath);
  settingsCache = migrateSettings(raw);
  await writeJsonAtomic(settingsPath, settingsCache);
  return settingsCache;
}

async function persistTasks(data: TaskData): Promise<void> {
  await writeJsonAtomic(getPaths().tasksPath, data);
}

async function persistSettings(settings: AppSettings): Promise<void> {
  await writeJsonAtomic(getPaths().settingsPath, settings);
}

function broadcast(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function currentMcpStatus(): McpStatus {
  return {
    running: mcpHandle !== null,
    port: mcpHandle?.port ?? null,
    ...(mcpError ? { error: mcpError } : {}),
  };
}

function pushMcpStatus(): void {
  broadcast('mcp:status-changed', currentMcpStatus());
}

/** MCP 创建任务：写入缓存 + 落盘 + 通知渲染进程刷新。 */
function createTaskFromMcp(draft: TaskDraft): Task {
  if (!tasksCache) {
    throw new Error('任务数据尚未加载');
  }
  const data = tasksCache;
  const group =
    draft.group === UNGROUPED || data.groups.includes(draft.group) ? draft.group : UNGROUPED;
  const task: Task = {
    id: data.seq,
    createdAt: Date.now(),
    order: nextNewOrder(data.tasks),
    done: false,
    completedAt: null,
    title: draft.title,
    note: draft.note,
    group,
    priority: draft.priority,
    dueAt: draft.dueAt,
  };
  tasksCache = {
    ...data,
    seq: data.seq + 1,
    tasks: [...data.tasks, task],
  };
  void persistTasks(tasksCache).catch((error: unknown) => {
    console.error('[desktop] MCP 创建任务后保存失败', error);
  });
  broadcast('tasks:changed', tasksCache);
  return task;
}

async function applyMcpEnabled(enabled: boolean): Promise<McpStatus> {
  if (!enabled) {
    if (mcpHandle) {
      const handle = mcpHandle;
      mcpHandle = null;
      await handle.close().catch(() => undefined);
    }
    mcpError = undefined;
    return currentMcpStatus();
  }

  if (mcpHandle) {
    return currentMcpStatus();
  }

  try {
    mcpHandle = await startMcpServer({
      port: MCP_DEFAULT_PORT,
      getData: () => tasksCache ?? { groups: [], groupColors: {}, seq: 1, tasks: [] },
      createTask: createTaskFromMcp,
      appVersion: app.getVersion(),
    });
    mcpError = undefined;
  } catch (error) {
    mcpHandle = null;
    mcpError = error instanceof Error ? error.message : '启动失败';
    console.error('[desktop] MCP Server 启动失败', error);
  }
  return currentMcpStatus();
}

function showMainWindow(): void {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function ensureTray(): void {
  if (tray) {
    return;
  }
  const iconPath = path.join(__dirname, '../../assets/tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Sylvie TaskList');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    show: false,
    backgroundColor: '#f5f6f7',
    title: 'Sylvie TaskList',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  attachDevCapture(window);

  window.on('maximize', () => broadcast('window:maximized-changed', true));
  window.on('unmaximize', () => broadcast('window:maximized-changed', false));

  window.on('close', (event) => {
    if (quitting) {
      return;
    }
    if (settingsCache?.['window.closeAction'] === 'tray' && tray) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        event.preventDefault();
        window.webContents.toggleDevTools();
      }
    });
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle('storage:load', async (): Promise<LoadResult> => {
    const [tasks, settings] = await Promise.all([ensureTasksLoaded(), ensureSettingsLoaded()]);
    return { tasks, settings, info: getInfo() };
  });

  ipcMain.handle('storage:save-tasks', async (_event, data: unknown): Promise<void> => {
    const normalized = migrateTaskData(data);
    tasksCache = normalized;
    await persistTasks(normalized);
  });

  ipcMain.handle('storage:save-settings', async (_event, data: unknown): Promise<void> => {
    const normalized = migrateSettings(data);
    settingsCache = normalized;
    await persistSettings(normalized);
    await applyMcpEnabled(normalized['mcp.serverEnabled']);
    pushMcpStatus();
  });

  ipcMain.handle('tasks:export', async (_event, data: unknown): Promise<FileOpResult<null>> => {
    const window = mainWindow;
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: '导出任务备份',
      defaultPath: path.join(app.getPath('downloads'), TASKS_FILE),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    try {
      const normalized = migrateTaskData(data);
      await writeJsonAtomic(filePath, normalized);
      return { ok: true, data: null, path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '写入失败' };
    }
  });

  ipcMain.handle('tasks:import', async (): Promise<FileOpResult<TaskData>> => {
    const window = mainWindow;
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: '导入任务备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    const filePath = filePaths[0];
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    try {
      const text = await readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(text);
      const data = migrateTaskData(parsed);
      return { ok: true, data, path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '文件解析失败' };
    }
  });

  ipcMain.handle(
    'settings:export',
    async (_event, settings: unknown): Promise<FileOpResult<null>> => {
      const window = mainWindow;
      if (!window) {
        return { ok: false, error: '窗口未就绪' };
      }
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: '导出配置',
        defaultPath: path.join(app.getPath('downloads'), SETTINGS_FILE),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }
      try {
        const normalized = migrateSettings(settings);
        await writeFile(filePath, serializeSettings(normalized), 'utf8');
        return { ok: true, data: null, path: filePath };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '写入失败' };
      }
    },
  );

  ipcMain.handle('settings:import', async (): Promise<FileOpResult<AppSettings>> => {
    const window = mainWindow;
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: '导入配置',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    const filePath = filePaths[0];
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    try {
      const text = await readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(text);
      return { ok: true, data: migrateSettings(parsed), path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '文件解析失败' };
    }
  });

  ipcMain.handle('app:info', () => getInfo());

  ipcMain.handle('shell:open-data-folder', async () => {
    await shell.openPath(getPaths().dataDir);
  });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  ipcMain.handle('mcp:set-enabled', async (_event, enabled: unknown): Promise<McpStatus> => {
    const settings = await ensureSettingsLoaded();
    const next = { ...settings, 'mcp.serverEnabled': enabled === true };
    settingsCache = next;
    await persistSettings(next);
    const status = await applyMcpEnabled(next['mcp.serverEnabled']);
    pushMcpStatus();
    return status;
  });

  ipcMain.handle('mcp:status', (): McpStatus => currentMcpStatus());
}

async function bootstrap(): Promise<void> {
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('com.sylvie.tasklist');

  await Promise.all([ensureTasksLoaded(), ensureSettingsLoaded()]);
  registerIpcHandlers();
  ensureTray();

  mainWindow = createWindow();

  if (settingsCache?.['mcp.serverEnabled']) {
    const status = await applyMcpEnabled(true);
    pushMcpStatus();
    if (status.error) {
      console.warn('[desktop] MCP Server 启动失败：', status.error);
    }
  }
}

const squirrelStarted = started;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (squirrelStarted || !gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.on('before-quit', () => {
    quitting = true;
    if (mcpHandle) {
      void mcpHandle.close().catch(() => undefined);
      mcpHandle = null;
    }
  });

  app.whenReady().then(bootstrap).catch((error: unknown) => {
    console.error('[desktop] 启动失败', error);
    app.quit();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      showMainWindow();
    }
  });
}
