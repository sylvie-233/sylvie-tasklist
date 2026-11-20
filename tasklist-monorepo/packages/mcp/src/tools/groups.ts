import { UNGROUPED } from '@sylvie/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { groupSummary, textResult } from '../format';
import type { TaskListRepository } from '../repository';

export function registerGroupTools(server: McpServer, repo: TaskListRepository): void {
  server.registerTool(
    'list_groups',
    {
      title: '查询分组',
      description: '列出全部分组及其颜色、任务数量（含「未分组」）。',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = repo.getData();
      const groups = [...data.groups, UNGROUPED].map((name) => groupSummary(data, name));
      return textResult({ total: groups.length, groups });
    },
  );

  server.registerTool(
    'create_group',
    {
      title: '创建分组',
      description: '新建一个任务分组，可选指定 #RRGGBB 颜色。',
      inputSchema: {
        name: z.string().min(1).describe('分组名称'),
        color: z.string().optional().describe('颜色，#RRGGBB 格式'),
      },
      annotations: { idempotentHint: false },
    },
    async ({ name, color }) => textResult({ created: repo.createGroup(name, color) }),
  );

  server.registerTool(
    'update_group',
    {
      title: '更新分组',
      description:
        '重命名分组或修改颜色。重命名会同步迁移该分组下的任务；color 传空串表示清除颜色。',
      inputSchema: {
        name: z.string().min(1).describe('现有分组名'),
        newName: z.string().min(1).optional().describe('新名称'),
        color: z.string().optional().describe('新颜色；空串清除颜色'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ name, newName, color }) =>
      textResult({
        updated: repo.updateGroup(name, {
          ...(newName === undefined ? {} : { name: newName }),
          ...(color === undefined ? {} : { color }),
        }),
      }),
  );

  server.registerTool(
    'delete_group',
    {
      title: '删除分组',
      description: '删除分组，其下任务会归入「未分组」（不会删除任务）。',
      inputSchema: {
        name: z.string().min(1).describe('分组名'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ name }) => textResult({ deleted: name, movedTasks: repo.deleteGroup(name) }),
  );
}
