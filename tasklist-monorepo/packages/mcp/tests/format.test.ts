import { describe, expect, it } from 'vitest';

import { groupSummary, parseColor, taskSummary } from '../src/format';
import type { Task, TaskData } from '@sylvie/core';

const baseTask: Task = {
  id: 7,
  createdAt: 1_700_000_000_000,
  done: false,
  completedAt: null,
  title: '测试任务',
  note: '备注',
  group: '工作',
  priority: 'high',
  dueAt: '2020-01-02T09:30',
};

describe('taskSummary', () => {
  it('输出稳定结构并附截止时间描述', () => {
    expect(taskSummary(baseTask)).toEqual({
      id: 7,
      title: '测试任务',
      note: '备注',
      group: '工作',
      priority: 'high',
      done: false,
      dueAt: '2020-01-02T09:30',
      due: { text: '1/2 09:30', overdue: true, hasTime: true },
      createdAt: new Date(1_700_000_000_000).toISOString(),
      completedAt: null,
    });
  });

  it('无截止时间与完成时间时输出 null', () => {
    const summary = taskSummary({
      ...baseTask,
      dueAt: '',
      done: true,
      completedAt: 1_700_000_100_000,
    });

    expect(summary.dueAt).toBeNull();
    expect(summary.due).toBeNull();
    expect(summary.completedAt).toBe(new Date(1_700_000_100_000).toISOString());
  });
});

describe('groupSummary', () => {
  const data: TaskData = {
    groups: ['工作'],
    groupColors: { 工作: '#2563eb' },
    seq: 4,
    tasks: [
      { ...baseTask, id: 1 },
      { ...baseTask, id: 2, done: true, completedAt: 1_700_000_100_000 },
      { ...baseTask, id: 3, group: '未分组' },
    ],
  };

  it('统计数量并带出分组颜色', () => {
    expect(groupSummary(data, '工作')).toEqual({
      name: '工作',
      color: '#2563eb',
      total: 2,
      active: 1,
      done: 1,
    });
  });

  it('没有配置颜色时返回 null', () => {
    expect(groupSummary(data, '未分组')).toEqual({
      name: '未分组',
      color: null,
      total: 1,
      active: 1,
      done: 0,
    });
  });
});

describe('parseColor', () => {
  it('空值返回 undefined，合法值转小写', () => {
    expect(parseColor(undefined)).toBeUndefined();
    expect(parseColor('')).toBeUndefined();
    expect(parseColor('#ABCDEF')).toBe('#abcdef');
  });

  it('非法色值抛出可读错误', () => {
    expect(() => parseColor('red')).toThrow(/颜色格式不合法/);
    expect(() => parseColor('#abc')).toThrow(/颜色格式不合法/);
  });
});
