import { viewTasks } from '@sylvie/core';
import { describeDue } from '@sylvie/utils';
import type { ViewState } from '@sylvie/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { taskSummary, textResult } from '../format';
import type { TaskListRepository } from '../repository';

const STATUS_VALUES = ['all', 'active', 'done'] as const;
const SORT_VALUES = ['priority', 'due', 'created', 'custom'] as const;
const PRIORITY_VALUES = ['high', 'mid', 'low'] as const;

function parseTime(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function registerTaskTools(server: McpServer, repo: TaskListRepository): void {
  server.registerTool(
    'list_tasks',
    {
      title: '查询任务',
      description:
        '查询任务清单。支持按分组、完成状态、优先级、关键词、是否逾期、截止时间区间过滤，并可指定排序与返回条数。',
      inputSchema: {
        group: z.string().optional().describe('分组名；省略表示所有分组'),
        status: z.enum(STATUS_VALUES).optional().describe('完成状态，默认 all'),
        priority: z.enum(PRIORITY_VALUES).optional().describe('优先级过滤'),
        search: z.string().optional().describe('标题 / 备注 / 分组关键词'),
        overdue: z.boolean().optional().describe('true 只看逾期未完成，false 只看未逾期'),
        dueBefore: z.string().optional().describe('截止时间早于此值（YYYY-MM-DD 或 ISO）'),
        dueAfter: z.string().optional().describe('截止时间晚于此值（YYYY-MM-DD 或 ISO）'),
        sort: z.enum(SORT_VALUES).optional().describe('排序方式，默认 due'),
        limit: z.number().int().min(1).max(500).optional().describe('返回条数上限，默认 100'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ group, status, priority, search, overdue, dueBefore, dueAfter, sort, limit }) => {
      const data = repo.getData();
      const view: ViewState = {
        group: group ?? '全部',
        filter: status === 'active' ? 'active' : status === 'done' ? 'done' : 'all',
        sort: sort ?? 'due',
        search: search ?? '',
      };

      let tasks = viewTasks(data, view, group ?? '全部');

      if (priority) {
        tasks = tasks.filter((task) => task.priority === priority);
      }

      const before = parseTime(dueBefore);
      const after = parseTime(dueAfter);
      if (before !== null) {
        tasks = tasks.filter((task) => task.dueAt !== '' && Date.parse(task.dueAt) <= before);
      }
      if (after !== null) {
        tasks = tasks.filter((task) => task.dueAt !== '' && Date.parse(task.dueAt) >= after);
      }
      if (overdue !== undefined) {
        tasks = tasks.filter((task) => (describeDue(task.dueAt)?.overdue === true) === overdue);
      }

      const sliced = tasks.slice(0, limit ?? 100);
      return textResult({
        total: tasks.length,
        returned: sliced.length,
        tasks: sliced.map(taskSummary),
      });
    },
  );

  server.registerTool(
    'get_task',
    {
      title: '获取任务详情',
      description: '按 id 获取单个任务的完整信息。',
      inputSchema: {
        id: z.number().int().positive().describe('任务 id'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const task = repo.getData().tasks.find((item) => item.id === id);
      if (!task) {
        throw new Error(`任务不存在：id=${id}`);
      }
      return textResult(taskSummary(task));
    },
  );

  server.registerTool(
    'create_task',
    {
      title: '创建任务',
      description:
        '创建一条任务。分组省略时使用设置中的默认分组；截止时间支持 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm。',
      inputSchema: {
        title: z.string().min(1).describe('任务标题（必填）'),
        note: z.string().optional().describe('备注'),
        group: z.string().optional().describe('分组名'),
        priority: z.enum(PRIORITY_VALUES).optional().describe('优先级，默认 mid'),
        dueAt: z.string().optional().describe('截止时间'),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (input) => textResult({ created: taskSummary(repo.createTask(input)) }),
  );

  server.registerTool(
    'update_task',
    {
      title: '更新任务',
      description:
        '更新任务的标题 / 备注 / 分组 / 优先级 / 截止时间（只传需要修改的字段；dueAt 传空串表示清空）。完成状态请用 set_task_done。',
      inputSchema: {
        id: z.number().int().positive().describe('任务 id'),
        title: z.string().min(1).optional().describe('新标题'),
        note: z.string().optional().describe('新备注'),
        group: z.string().optional().describe('新分组'),
        priority: z.enum(PRIORITY_VALUES).optional().describe('新优先级'),
        dueAt: z.string().optional().describe('新截止时间，空串清空'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ id, ...patch }) => textResult({ updated: taskSummary(repo.updateTask(id, patch)) }),
  );

  server.registerTool(
    'set_task_done',
    {
      title: '设置完成状态',
      description: '把任务标记为已完成或未完成；完成时自动记录完成时间，取消完成时清除。',
      inputSchema: {
        id: z.number().int().positive().describe('任务 id'),
        done: z.boolean().describe('true 标记完成，false 恢复进行中'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ id, done }) => textResult({ updated: taskSummary(repo.setTaskDone(id, done)) }),
  );

  server.registerTool(
    'delete_task',
    {
      title: '删除任务',
      description: '删除一条任务，不可恢复。',
      inputSchema: {
        id: z.number().int().positive().describe('任务 id'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      repo.deleteTask(id);
      return textResult({ deleted: id });
    },
  );

  server.registerTool(
    'move_task',
    {
      title: '移动任务',
      description:
        '把任务移动到指定分组，或调整其在自定义排序中的位置（beforeId / afterId 二选一，按任务 id 指定相对位置）。',
      inputSchema: {
        id: z.number().int().positive().describe('要移动的任务 id'),
        group: z.string().optional().describe('目标分组；省略表示不改分组'),
        beforeId: z.number().int().positive().optional().describe('放到该任务之前'),
        afterId: z.number().int().positive().optional().describe('放到该任务之后'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ id, group, beforeId, afterId }) => {
      if (beforeId !== undefined && afterId !== undefined) {
        throw new Error('beforeId 与 afterId 不能同时指定');
      }
      return textResult({ moved: taskSummary(repo.moveTask(id, { group, beforeId, afterId })) });
    },
  );
}
