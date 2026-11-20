import type { Priority, SortMode, Task, TaskData, ViewState } from './types';
import { ALL_GROUP, UNGROUPED } from './types';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, mid: 1, low: 2 };

/** 任务的“有效顺序值”：有 `order` 用 `order`，否则回退创建时间。 */
export function effectiveOrder(task: Task): number {
  return task.order ?? task.createdAt;
}

/** 新建任务时的顺序值：置于自定义排序顶部。 */
export function nextNewOrder(tasks: Task[]): number {
  if (tasks.length === 0) {
    return 1;
  }
  return Math.min(...tasks.map(effectiveOrder)) - 1;
}

/**
 * 计算插到 `beforeId` 与 `afterId` 之间的顺序值（中点插值）。
 * 只写被拖任务一个字段，不重排其他任务。
 */
export function orderBetween(
  tasks: Task[],
  beforeId?: number,
  afterId?: number,
): number | null {
  const before = beforeId === undefined ? undefined : tasks.find((task) => task.id === beforeId);
  const after = afterId === undefined ? undefined : tasks.find((task) => task.id === afterId);

  if (before && after) {
    return (effectiveOrder(before) + effectiveOrder(after)) / 2;
  }
  if (before) {
    return effectiveOrder(before) + 1;
  }
  if (after) {
    return effectiveOrder(after) - 1;
  }
  return null;
}

/**
 * 排序：自定义排序严格按 `order`；规则排序一律“已完成整体沉底”，段内再按规则排。
 */
export function sortTasks(tasks: Task[], sort: SortMode): Task[] {
  const list = [...tasks];
  if (sort === 'custom') {
    return list.sort((a, b) => effectiveOrder(a) - effectiveOrder(b));
  }
  list.sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    if (sort === 'priority') {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt;
    }
    if (sort === 'due') {
      const left = a.dueAt || '9999';
      const right = b.dueAt || '9999';
      return left.localeCompare(right) || a.createdAt - b.createdAt;
    }
    return a.createdAt - b.createdAt;
  });
  return list;
}

/** 当前视图下某个分组的任务（分组 + 筛选 + 搜索 + 排序，全应用唯一取数口径）。 */
export function viewTasks(data: TaskData, view: ViewState, group: string = view.group): Task[] {
  let list = data.tasks;
  if (group !== ALL_GROUP) {
    list = list.filter((task) => task.group === group);
  }
  if (view.filter === 'active') {
    list = list.filter((task) => !task.done);
  } else if (view.filter === 'done') {
    list = list.filter((task) => task.done);
  }
  const keyword = view.search.trim().toLowerCase();
  if (keyword) {
    list = list.filter(
      (task) =>
        task.title.toLowerCase().includes(keyword) ||
        task.note.toLowerCase().includes(keyword) ||
        task.group.toLowerCase().includes(keyword),
    );
  }
  return sortTasks(list, view.sort);
}

/** 侧边栏某项的计数，与右侧列表口径一致。 */
export function groupCount(data: TaskData, view: ViewState, group: string): number {
  return viewTasks(data, view, group).length;
}

/** 侧边栏分组列表：「全部」+ 自定义分组 +（存在未分组任务时）「未分组」。 */
export function sidebarGroups(data: TaskData): string[] {
  const groups = [ALL_GROUP, ...data.groups];
  if (data.tasks.some((task) => task.group === UNGROUPED)) {
    groups.push(UNGROUPED);
  }
  return groups;
}

/** 分组颜色；未设置时返回 null（界面用中性色兜底）。 */
export function groupColor(data: TaskData, group: string): string | null {
  return data.groupColors[group] ?? null;
}

/** 统计信息。 */
export function taskStats(tasks: Task[]): { total: number; active: number; done: number } {
  const total = tasks.length;
  const active = tasks.filter((task) => !task.done).length;
  return { total, active, done: total - active };
}

/** 状态栏范围文案。 */
export function scopeLabel(group: string): string {
  return group === ALL_GROUP ? '全部任务' : `分组「${group}」`;
}
