import type { AppSettings, Priority, Task, TaskData } from '@sylvie/core';

/** 创建任务的入参（分组不传时使用设置中的默认分组）。 */
export interface CreateTaskInput {
  title: string;
  note?: string;
  group?: string;
  priority?: Priority;
  /** `YYYY-MM-DDTHH:mm` 或纯日期 `YYYY-MM-DD`。 */
  dueAt?: string;
}

/** 任务可更新字段；`dueAt` 传空串表示清空截止时间。 */
export interface UpdateTaskInput {
  title?: string;
  note?: string;
  group?: string;
  priority?: Priority;
  dueAt?: string;
}

/** 移动任务：可同时改分组与自定义顺序位置。 */
export interface MoveTaskInput {
  group?: string;
  /** 放到该任务之前（与 afterId 二选一）。 */
  beforeId?: number;
  /** 放到该任务之后（与 beforeId 二选一）。 */
  afterId?: number;
}

/** 分组概览。 */
export interface GroupSummary {
  name: string;
  color: string | null;
  total: number;
  active: number;
  done: number;
}

/**
 * MCP 数据仓库端口：由宿主（Electron 主进程 / 测试替身）实现。
 *
 * 实现方负责持久化与变更通知；本包只描述语义，不关心存储细节。
 * 约定：目标不存在或入参非法时抛出 Error，消息会作为工具错误返回给客户端。
 */
export interface TaskListRepository {
  getData(): TaskData;
  getSettings(): AppSettings;

  createTask(input: CreateTaskInput): Task;
  updateTask(id: number, input: UpdateTaskInput): Task;
  setTaskDone(id: number, done: boolean): Task;
  deleteTask(id: number): void;
  moveTask(id: number, input: MoveTaskInput): Task;

  createGroup(name: string, color?: string): GroupSummary;
  updateGroup(name: string, patch: { name?: string; color?: string | null }): GroupSummary;
  /** 删除分组，其任务归入「未分组」；返回受影响任务数。 */
  deleteGroup(name: string): number;
}
