import type { Task, TaskData } from '@sylvie/core';
import { describeDue, normalizeHexColor } from '@sylvie/utils';

/** 工具返回的文本结果（JSON 便于模型与人工阅读）。 */
export function textResult(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** 任务摘要：MCP 客户端友好的稳定结构。 */
export function taskSummary(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    group: task.group,
    priority: task.priority,
    done: task.done,
    dueAt: task.dueAt || null,
    due: task.dueAt ? describeDue(task.dueAt) : null,
    createdAt: new Date(task.createdAt).toISOString(),
    completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
  };
}

/** 分组信息（含颜色与计数）。 */
export function groupSummary(data: TaskData, name: string): {
  name: string;
  color: string | null;
  total: number;
  active: number;
  done: number;
} {
  const tasks = data.tasks.filter((task) => task.group === name);
  const done = tasks.filter((task) => task.done).length;
  return {
    name,
    color: data.groupColors[name] ?? null,
    total: tasks.length,
    active: tasks.length - done,
    done,
  };
}

/** 校验并规范十六进制颜色；空值返回 undefined，非法值抛错。 */
export function parseColor(color: string | undefined | null): string | undefined {
  if (color === undefined || color === null || color === '') {
    return undefined;
  }
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    throw new Error(`颜色格式不合法：${color}（应为 #RRGGBB）`);
  }
  return normalized;
}
