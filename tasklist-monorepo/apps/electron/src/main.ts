import { app, BrowserWindow, Menu } from 'electron';
import started from 'electron-squirrel-startup';

import { state } from './main/context';
import { registerIpcHandlers } from './main/ipc';
import { applyMcpEnabled, closeMcpServer, pushMcpStatus } from './main/mcp/service';
import { ensureSettingsLoaded, ensureTasksLoaded } from './main/storage';
import { ensureTray } from './main/tray';
import { createMainWindow, showMainWindow } from './main/window';

/**
 * Electron 主进程入口：只负责应用生命周期与模块装配。
 * 具体职责拆分在 `src/main/`：
 * - context  进程级状态 / 路径 / 广播
 * - storage  tasks.json / settings.json 原子读写与迁移
 * - window   主窗口创建与显示
 * - tray     系统托盘
 * - ipc      按域注册 IPC（storage / files / window / mcp）
 * - mcp      MCP 服务启停与仓库适配
 */
async function bootstrap(): Promise<void> {
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('com.sylvie.tasklist');

  await Promise.all([ensureTasksLoaded(), ensureSettingsLoaded()]);
  registerIpcHandlers();
  ensureTray();

  state.window = createMainWindow();

  // 配置里开启了 MCP 时随应用启动
  if (state.settings?.['mcp.serverEnabled']) {
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
    state.quitting = true;
    void closeMcpServer();
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
      state.window = createMainWindow();
    } else {
      showMainWindow();
    }
  });
}
