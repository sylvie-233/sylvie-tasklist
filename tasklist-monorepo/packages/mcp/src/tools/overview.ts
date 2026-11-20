import { UNGROUPED, sortTasks } from '@sylvie/core';
import { describeDue } from '@sylvie/utils';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { taskSummary, textResult } from '../format';
import type { TaskListRepository } from '../repository';

export function registerOverviewTool(server: McpServer, repo: TaskListRepository): void {
  server.registerTool(
    'get_overview',
    {
      title: '任务概览',
      description:
        '汇总任务整体情况：总数 / 进行中 / 已完成 / 逾期数量、按分组的分布，以及最近到期的若干条任务。',
      inputSchema: {
        group: z.string().optional().describe('只看某个分组；省略表示全部'),
        upcomingLimit: z.number().int().min(1).max(20).optional().describe('最近到期任务条数，默认 5'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ group, upcomingLimit }) => {
      const data = repo.getData();
      const scoped = group ? data.tasks.filter((task) => task.group === group) : data.tasks;
      const done = scoped.filter((task) => task.done).length;
      const overdueTasks = scoped.filter(
        (task) => !task.done && describeDue(task.dueAt)?.overdue === true,
      );

      const byGroup = [...data.groups, UNGROUPED]
        .map((name) => {
          const tasks = data.tasks.filter((task) => task.group === name);
          return {
            name,
            total: tasks.length,
            active: tasks.filter((task) => !task.done).length,
            done: tasks.filter((task) => task.done).length,
          };
        })
        .filter((entry) => !group || entry.name === group);

      const upcoming = sortTasks(
        scoped.filter((task) => !task.done && task.dueAt !== ''),
        'due',
      ).slice(0, upcomingLimit ?? 5);

      return textResult({
        scope: group ?? '全部',
        total: scoped.length,
        active: scoped.length - done,
        done,
        overdue: overdueTasks.length,
        overdueTasks: overdueTasks.slice(0, 10).map(taskSummary),
        byGroup,
        upcoming: upcoming.map(taskSummary),
      });
    },
  );
}
