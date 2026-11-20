import { app } from 'electron';

import type { AppSettings, TaskData } from '@sylvie/core';
import { startMcpHttpServer } from '@sylvie/mcp';

import type { McpStatus } from '../../desktop-types';
import { MCP_DEFAULT_PORT, broadcast, requireSettings, requireTasks, state } from '../context';
import { persistSettings, persistTasks } from '../storage';
import { createTaskListRepository } from './repository';

/** MCP 写入任务：更新缓存 + 落盘 + 通知渲染进程。 */
function commitTasks(next: TaskData): void {
  state.tasks = next;
  void persistTasks(next).catch((error: unknown) => {
    console.error('[desktop] MCP 写入 tasks.json 失败', error);
  });
  broadcast('tasks:changed', next);
}

/** MCP 写入配置：更新缓存 + 落盘 + 通知渲染进程。 */
function commitSettings(next: AppSettings): void {
  state.settings = next;
  void persistSettings(next).catch((error: unknown) => {
    console.error('[desktop] MCP 写入 settings.json 失败', error);
  });
  broadcast('settings:changed', next);
}

export function currentMcpStatus(): McpStatus {
  return {
    running: state.mcp !== null,
    port: state.mcp?.port ?? null,
    ...(state.mcpError ? { error: state.mcpError } : {}),
  };
}

export function pushMcpStatus(): void {
  broadcast('mcp:status-changed', currentMcpStatus());
}

/** 启停 MCP Server（幂等：重复开启不会起第二个实例）。 */
export async function applyMcpEnabled(enabled: boolean): Promise<McpStatus> {
  if (!enabled) {
    await closeMcpServer();
    state.mcpError = undefined;
    return currentMcpStatus();
  }

  if (state.mcp) {
    return currentMcpStatus();
  }

  try {
    state.mcp = await startMcpHttpServer({
      port: MCP_DEFAULT_PORT,
      version: app.getVersion(),
      repo: createTaskListRepository({
        getTasks: requireTasks,
        commitTasks,
        getSettings: requireSettings,
        commitSettings,
      }),
    });
    state.mcpError = undefined;
  } catch (error) {
    state.mcp = null;
    state.mcpError = error instanceof Error ? error.message : '启动失败';
    console.error('[desktop] MCP Server 启动失败', error);
  }
  return currentMcpStatus();
}

/** 关闭 MCP Server（退出应用时调用）。 */
export async function closeMcpServer(): Promise<void> {
  if (!state.mcp) {
    return;
  }
  const handle = state.mcp;
  state.mcp = null;
  await handle.close().catch(() => undefined);
}
