import { ipcMain, shell } from 'electron';

import { migrateSettings, migrateTaskData } from '@sylvie/core';

import type { LoadResult } from '../../desktop-types';
import { getInfo, getPaths, state } from '../context';
import { applyMcpEnabled, pushMcpStatus } from '../mcp/service';
import {
  ensureSettingsLoaded,
  ensureTasksLoaded,
  persistSettings,
  persistTasks,
} from '../storage';

/** 数据加载 / 保存与基础环境信息。 */
export function registerStorageIpc(): void {
  ipcMain.handle('storage:load', async (): Promise<LoadResult> => {
    const [tasks, settings] = await Promise.all([ensureTasksLoaded(), ensureSettingsLoaded()]);
    return { tasks, settings, info: getInfo() };
  });

  ipcMain.handle('storage:save-tasks', async (_event, data: unknown): Promise<void> => {
    const normalized = migrateTaskData(data);
    state.tasks = normalized;
    await persistTasks(normalized);
  });

  ipcMain.handle('storage:save-settings', async (_event, data: unknown): Promise<void> => {
    const normalized = migrateSettings(data);
    state.settings = normalized;
    await persistSettings(normalized);
    // 配置里的 MCP 开关随保存实时生效
    await applyMcpEnabled(normalized['mcp.serverEnabled']);
    pushMcpStatus();
  });

  ipcMain.handle('app:info', () => getInfo());

  ipcMain.handle('shell:open-data-folder', async () => {
    await shell.openPath(getPaths().dataDir);
  });
}
