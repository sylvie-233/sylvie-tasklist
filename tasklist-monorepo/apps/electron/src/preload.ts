import { contextBridge, ipcRenderer } from 'electron';

import type { AppSettings, TaskData } from '@sylvie/core';

import type {
  AppInfo,
  DesktopApi,
  FileOpResult,
  LoadResult,
  McpStatus,
} from './desktop-types';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: DesktopApi = {
  loadAll: (): Promise<LoadResult> => ipcRenderer.invoke('storage:load'),
  saveTasks: (data: TaskData): Promise<void> => ipcRenderer.invoke('storage:save-tasks', data),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('storage:save-settings', settings),
  exportTasks: (data: TaskData): Promise<FileOpResult<null>> =>
    ipcRenderer.invoke('tasks:export', data),
  importTasks: (): Promise<FileOpResult<TaskData>> => ipcRenderer.invoke('tasks:import'),
  exportSettings: (settings: AppSettings): Promise<FileOpResult<null>> =>
    ipcRenderer.invoke('settings:export', settings),
  importSettings: (): Promise<FileOpResult<AppSettings>> => ipcRenderer.invoke('settings:import'),
  getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  openDataFolder: (): Promise<void> => ipcRenderer.invoke('shell:open-data-folder'),
  minimize: (): void => {
    ipcRenderer.send('window:minimize');
  },
  toggleMaximize: (): void => {
    ipcRenderer.send('window:toggle-maximize');
  },
  close: (): void => {
    ipcRenderer.send('window:close');
  },
  setMcpEnabled: (enabled: boolean): Promise<McpStatus> =>
    ipcRenderer.invoke('mcp:set-enabled', enabled),
  getMcpStatus: (): Promise<McpStatus> => ipcRenderer.invoke('mcp:status'),
  onMcpStatus: (listener: (status: McpStatus) => void): (() => void) =>
    subscribe('mcp:status-changed', listener),
  onMaximizedChange: (listener: (maximized: boolean) => void): (() => void) =>
    subscribe('window:maximized-changed', listener),
  onTasksChanged: (listener: (tasks: TaskData) => void): (() => void) =>
    subscribe('tasks:changed', listener),
  onSettingsChanged: (listener: (settings: AppSettings) => void): (() => void) =>
    subscribe('settings:changed', listener),
};

contextBridge.exposeInMainWorld('desktop', api);
