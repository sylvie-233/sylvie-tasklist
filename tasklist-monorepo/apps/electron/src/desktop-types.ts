import type { AppSettings, TaskData } from '@sylvie/core';

/** 数据文件位置。 */
export interface AppPaths {
  dataDir: string;
  tasksPath: string;
  settingsPath: string;
}

/** 主进程回传的应用信息。 */
export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  paths: AppPaths;
}

/** 启动时一次性加载的数据。 */
export interface LoadResult {
  tasks: TaskData;
  settings: AppSettings;
  info: AppInfo;
}

/** 导入/导出类操作的统一返回。 */
export type FileOpResult<T> =
  | { ok: true; data: T; path: string }
  | { ok: false; canceled?: boolean; error?: string };
/** MCP Server 运行状态。 */
export interface McpStatus {
  running: boolean;
  port: number | null;
  error?: string;
}

/** 预加载脚本暴露给渲染进程的 API。 */
export interface DesktopApi {
  loadAll(): Promise<LoadResult>;
  saveTasks(data: TaskData): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  exportTasks(data: TaskData): Promise<FileOpResult<null>>;
  importTasks(): Promise<FileOpResult<TaskData>>;
  exportSettings(settings: AppSettings): Promise<FileOpResult<null>>;
  importSettings(): Promise<FileOpResult<AppSettings>>;
  getInfo(): Promise<AppInfo>;
  openDataFolder(): Promise<void>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  setMcpEnabled(enabled: boolean): Promise<McpStatus>;
  getMcpStatus(): Promise<McpStatus>;
  /** 订阅 MCP 状态变化，返回取消订阅函数。 */
  onMcpStatus(listener: (status: McpStatus) => void): () => void;
  /** 订阅窗口最大化状态变化，返回取消订阅函数。 */
  onMaximizedChange(listener: (maximized: boolean) => void): () => void;
  /** 订阅主进程侧产生的任务变更（如 MCP 创建任务），返回取消订阅函数。 */
  onTasksChanged(listener: (tasks: TaskData) => void): () => void;
}
