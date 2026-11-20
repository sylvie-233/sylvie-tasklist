import path from 'node:path';

import type { AppSettings, TaskData } from '@sylvie/core';
import type { McpHttpServerHandle } from '@sylvie/mcp';
import { app, type BrowserWindow, type Tray } from 'electron';

import type { AppInfo, AppPaths } from '../desktop-types';

export const TASKS_FILE = 'tasks.json';
export const SETTINGS_FILE = 'settings.json';
export const MCP_DEFAULT_PORT = 37821;

/**
 * 主进程的进程级状态（单窗口应用，模块级单例足够）。
 * 集中放置避免各模块互相 import 具体变量造成循环依赖。
 */
export interface MainState {
  window: BrowserWindow | null;
  tray: Tray | null;
  quitting: boolean;
  tasks: TaskData | null;
  settings: AppSettings | null;
  mcp: McpHttpServerHandle | null;
  mcpError?: string;
}

export const state: MainState = {
  window: null,
  tray: null,
  quitting: false,
  tasks: null,
  settings: null,
  mcp: null,
};

export function getPaths(): AppPaths {
  const dataDir = app.getPath('userData');
  return {
    dataDir,
    tasksPath: path.join(dataDir, TASKS_FILE),
    settingsPath: path.join(dataDir, SETTINGS_FILE),
  };
}

export function getInfo(): AppInfo {
  return {
    version: app.getVersion(),
    platform: process.platform,
    paths: getPaths(),
  };
}

/** 向渲染进程推送事件（窗口不存在时静默忽略）。 */
export function broadcast(channel: string, payload: unknown): void {
  if (state.window && !state.window.isDestroyed()) {
    state.window.webContents.send(channel, payload);
  }
}

export function requireTasks(): TaskData {
  if (!state.tasks) {
    throw new Error('任务数据尚未加载');
  }
  return state.tasks;
}

export function requireSettings(): AppSettings {
  if (!state.settings) {
    throw new Error('应用配置尚未加载');
  }
  return state.settings;
}
