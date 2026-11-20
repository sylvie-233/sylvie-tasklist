import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, dialog, ipcMain } from 'electron';

import { migrateSettings, migrateTaskData, serializeSettings } from '@sylvie/core';
import type { AppSettings, TaskData } from '@sylvie/core';

import type { FileOpResult } from '../../desktop-types';
import { SETTINGS_FILE, TASKS_FILE, state } from '../context';
import { writeJsonAtomic } from '../storage';

const JSON_FILTER = [{ name: 'JSON', extensions: ['json'] }];

function requireWindow(): Electron.BrowserWindow | null {
  return state.window && !state.window.isDestroyed() ? state.window : null;
}

/** 任务备份与配置文件的导入 / 导出对话框。 */
export function registerFileIpc(): void {
  ipcMain.handle('tasks:export', async (_event, data: unknown): Promise<FileOpResult<null>> => {
    const window = requireWindow();
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }

    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: '导出任务备份',
      defaultPath: path.join(app.getPath('downloads'), TASKS_FILE),
      filters: JSON_FILTER,
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await writeJsonAtomic(filePath, migrateTaskData(data));
      return { ok: true, data: null, path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '写入失败' };
    }
  });

  ipcMain.handle('tasks:import', async (): Promise<FileOpResult<TaskData>> => {
    const window = requireWindow();
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: '导入任务备份',
      properties: ['openFile'],
      filters: JSON_FILTER,
    });
    const filePath = filePaths[0];
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      return { ok: true, data: migrateTaskData(parsed), path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '文件解析失败' };
    }
  });

  ipcMain.handle(
    'settings:export',
    async (_event, settings: unknown): Promise<FileOpResult<null>> => {
      const window = requireWindow();
      if (!window) {
        return { ok: false, error: '窗口未就绪' };
      }

      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: '导出配置',
        defaultPath: path.join(app.getPath('downloads'), SETTINGS_FILE),
        filters: JSON_FILTER,
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }

      try {
        // 配置导出保留点分键顺序与格式，便于直接手改
        await writeFile(filePath, serializeSettings(migrateSettings(settings)), 'utf8');
        return { ok: true, data: null, path: filePath };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '写入失败' };
      }
    },
  );

  ipcMain.handle('settings:import', async (): Promise<FileOpResult<AppSettings>> => {
    const window = requireWindow();
    if (!window) {
      return { ok: false, error: '窗口未就绪' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: '导入配置',
      properties: ['openFile'],
      filters: JSON_FILTER,
    });
    const filePath = filePaths[0];
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      return { ok: true, data: migrateSettings(parsed), path: filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '文件解析失败' };
    }
  });
}
