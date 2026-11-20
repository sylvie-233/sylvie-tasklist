import { describe, expect, it } from 'vitest';

import { DEFAULT_GROUPS, DEFAULT_SETTINGS } from './defaults';
import { migrateSettings, migrateTaskData, serializeSettings } from './migration';
import { UNGROUPED } from './types';

describe('migrateTaskData', () => {
  it('迁移旧字段、清洗分组并丢弃坏任务', () => {
    const data = migrateTaskData({
      groups: ['工作', '', '未分组', '全部', '工作'],
      groupColors: { 工作: '#2563EB', 学习: '#16A34A' },
      seq: 2,
      tasks: [
        {
          id: 1,
          created: 1_000,
          title: '  旧任务  ',
          due: '2026-11-21',
          priority: 'high',
          group: '工作',
        },
        { id: 2, title: '分组已删除', group: '已删除', priority: 'urgent' },
        { id: 3, title: '   ' },
        'not-a-task',
      ],
    });

    expect(data.groups).toEqual(['工作']);
    expect(data.groupColors).toEqual({ 工作: '#2563EB' });
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0]).toMatchObject({
      id: 1,
      createdAt: 1_000,
      title: '旧任务',
      dueAt: '2026-11-21T09:00',
    });
    expect(data.tasks[1]).toMatchObject({
      id: 2,
      group: UNGROUPED,
      priority: 'mid',
      completedAt: null,
      dueAt: '',
    });
    expect(data.seq).toBe(3);
  });

  it('无法解析时回退默认分组与空任务', () => {
    const data = migrateTaskData(null);
    expect(data.groups).toEqual(DEFAULT_GROUPS);
    expect(data.tasks).toEqual([]);
    expect(data.seq).toBe(1);
    expect(data.groupColors).toEqual({});
  });

  it('保留更大的 seq，并只接受数字 order', () => {
    const keptSeq = migrateTaskData({ groups: ['工作'], seq: 99, tasks: [] });
    expect(keptSeq.seq).toBe(99);

    const withOrder = migrateTaskData({
      groups: ['工作'],
      tasks: [{ id: 1, title: '有顺序', order: 12.5 }],
    });
    expect(withOrder.tasks[0]).toMatchObject({ order: 12.5 });

    const withoutOrder = migrateTaskData({
      groups: ['工作'],
      tasks: [{ id: 1, title: '顺序非法', order: 'x' }],
    });
    expect(withoutOrder.tasks[0]).not.toHaveProperty('order');
  });
});

describe('migrateSettings', () => {
  it('旧扁平键映射到命名空间键，非法值回退默认', () => {
    const settings = migrateSettings({
      theme: 'dark',
      fontSize: 'huge',
      closeAction: 'quit',
      defaultGroup: '  学习 ',
      defaultPriority: 'high',
      overdueHighlight: false,
      mcpEnabled: true,
      unknownKey: 'ignored',
    });

    expect(settings['appearance.theme']).toBe('dark');
    expect(settings['appearance.fontSize']).toBe('standard');
    expect(settings['window.closeAction']).toBe('quit');
    expect(settings['task.defaultGroup']).toBe('学习');
    expect(settings['task.defaultPriority']).toBe('high');
    expect(settings['task.overdueHighlight']).toBe(false);
    expect(settings['mcp.serverEnabled']).toBe(true);
    expect(settings).not.toHaveProperty('unknownKey');
  });

  it('命名空间键优先于旧键', () => {
    const settings = migrateSettings({ theme: 'dark', 'appearance.theme': 'light' });
    expect(settings['appearance.theme']).toBe('light');
  });

  it('非对象输入返回默认配置', () => {
    expect(migrateSettings('not-an-object')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('serializeSettings', () => {
  it('按固定键序输出并以换行结尾', () => {
    const text = serializeSettings(DEFAULT_SETTINGS);
    expect(text.endsWith('\n')).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });
});
