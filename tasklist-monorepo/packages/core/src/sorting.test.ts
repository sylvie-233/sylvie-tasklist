import { describe, expect, it } from 'vitest';

import {
  effectiveOrder,
  nextNewOrder,
  orderBetween,
  orderForPosition,
  sidebarGroups,
  sortTasks,
  taskStats,
  viewTasks,
} from './sorting';
import { ALL_GROUP, UNGROUPED } from './types';
import type { Task, TaskData, ViewState } from './types';

function makeTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    createdAt: 1_000,
    done: false,
    completedAt: null,
    title: `任务 ${overrides.id}`,
    note: '',
    group: '工作',
    priority: 'mid',
    dueAt: '',
    ...overrides,
  };
}

function makeView(overrides: Partial<ViewState> = {}): ViewState {
  return { group: ALL_GROUP, filter: 'all', sort: 'custom', search: '', ...overrides };
}

describe('排序值计算', () => {
  it('order 缺省时回退创建时间', () => {
    expect(effectiveOrder(makeTask({ id: 1, createdAt: 500 }))).toBe(500);
    expect(effectiveOrder(makeTask({ id: 2, createdAt: 500, order: 12 }))).toBe(12);
  });

  it('新任务顺序值置于当前最小值之前', () => {
    expect(nextNewOrder([])).toBe(1);
    expect(
      nextNewOrder([makeTask({ id: 1, createdAt: 1_000 }), makeTask({ id: 2, order: 10 })]),
    ).toBe(9);
  });

  it('orderBetween 取中点并处理首尾边界', () => {
    const first = makeTask({ id: 1, order: 10 });
    const second = makeTask({ id: 2, order: 20 });
    const tasks = [first, second];

    expect(orderBetween(tasks, 1, 2)).toBe(15);
    expect(orderBetween(tasks, 1)).toBe(11);
    expect(orderBetween(tasks, undefined, 2)).toBe(19);
    expect(orderBetween(tasks)).toBeNull();
  });

  it('orderForPosition 按目标与位置找邻居', () => {
    const tasks = [
      makeTask({ id: 1, order: 10 }),
      makeTask({ id: 2, order: 20 }),
      makeTask({ id: 3, order: 30 }),
    ];

    expect(orderForPosition(tasks, 3, 2, 'before')).toBe(15);
    expect(orderForPosition(tasks, 1, 2, 'after')).toBe(25);
    expect(orderForPosition(tasks, 1, 2, 'before')).toBe(19);
    expect(orderForPosition(tasks, 1, 1, 'before')).toBeNull();
    expect(orderForPosition(tasks, 1, 99, 'after')).toBeNull();
  });
});

describe('规则排序', () => {
  it('按优先级排序：已完成沉底，同级按创建时间', () => {
    const doneHigh = makeTask({ id: 1, done: true, priority: 'high', createdAt: 100 });
    const lowActive = makeTask({ id: 2, priority: 'low', createdAt: 200 });
    const highActive = makeTask({ id: 3, priority: 'high', createdAt: 300 });
    const midLater = makeTask({ id: 4, priority: 'mid', createdAt: 400 });
    const midEarlier = makeTask({ id: 5, priority: 'mid', createdAt: 250 });

    const sorted = sortTasks([doneHigh, lowActive, highActive, midLater, midEarlier], 'priority');
    expect(sorted.map((task) => task.id)).toEqual([3, 5, 4, 2, 1]);
  });

  it('按截止时间排序：未设置截止时间排最后', () => {
    const noDue = makeTask({ id: 1, dueAt: '' });
    const late = makeTask({ id: 2, dueAt: '2026-11-25T09:00' });
    const early = makeTask({ id: 3, dueAt: '2026-11-21T09:00' });

    expect(sortTasks([noDue, late, early], 'due').map((task) => task.id)).toEqual([3, 2, 1]);
  });

  it('自定义排序不强制已完成沉底', () => {
    const done = makeTask({ id: 1, done: true, order: 1 });
    const active = makeTask({ id: 2, order: 2 });

    expect(sortTasks([active, done], 'custom').map((task) => task.id)).toEqual([1, 2]);
  });
});

describe('视图取数', () => {
  const data: TaskData = {
    groups: ['工作', '生活'],
    groupColors: {},
    seq: 4,
    tasks: [
      makeTask({ id: 1, createdAt: 100, group: '工作', title: '写周报', note: '包含项目进展' }),
      makeTask({ id: 2, createdAt: 200, group: '生活', title: '买菜', done: true }),
      makeTask({ id: 3, createdAt: 300, group: UNGROUPED, title: '整理桌面' }),
    ],
  };

  it('按分组与完成状态过滤', () => {
    expect(viewTasks(data, makeView()).map((task) => task.id)).toEqual([1, 2, 3]);
    expect(viewTasks(data, makeView({ filter: 'active' })).map((task) => task.id)).toEqual([1, 3]);
    expect(viewTasks(data, makeView({ filter: 'done' })).map((task) => task.id)).toEqual([2]);
    expect(viewTasks(data, makeView(), '生活').map((task) => task.id)).toEqual([2]);
  });

  it('关键词匹配标题、备注与分组', () => {
    expect(viewTasks(data, makeView({ search: '周报' })).map((task) => task.id)).toEqual([1]);
    expect(viewTasks(data, makeView({ search: '项目进展' })).map((task) => task.id)).toEqual([1]);
    expect(viewTasks(data, makeView({ search: '生活' })).map((task) => task.id)).toEqual([2]);
  });

  it('侧边栏仅在存在未分组任务时追加「未分组」', () => {
    expect(sidebarGroups(data)).toEqual([ALL_GROUP, '工作', '生活', UNGROUPED]);
    expect(
      sidebarGroups({ ...data, tasks: data.tasks.filter((task) => task.group !== UNGROUPED) }),
    ).toEqual([ALL_GROUP, '工作', '生活']);
  });

  it('统计总数 / 进行中 / 已完成', () => {
    expect(taskStats(data.tasks)).toEqual({ total: 3, active: 2, done: 1 });
  });
});
