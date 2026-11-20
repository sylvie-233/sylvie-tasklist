import { describe, expect, it } from 'vitest';

import { SETTINGS_CATEGORIES, SETTINGS_ITEMS, resolveSettingOptions } from './settings-schema';

describe('设置项定义', () => {
  it('分类顺序与导航一致', () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      'general',
      'appearance',
      'task',
      'mcp',
      'data',
      'json',
      'hotkeys',
    ]);
  });

  it('动态分组选项始终包含「未分组」', () => {
    const item = SETTINGS_ITEMS.find((entry) => entry.key === 'task.defaultGroup');
    if (!item) {
      throw new Error('缺少默认分组设置项');
    }

    expect(resolveSettingOptions(item, ['工作', '生活']).map((option) => option.value)).toEqual([
      '工作',
      '生活',
      '未分组',
    ]);
  });

  it('静态选项原样返回', () => {
    const item = SETTINGS_ITEMS.find((entry) => entry.key === 'appearance.theme');
    if (!item) {
      throw new Error('缺少主题设置项');
    }

    expect(resolveSettingOptions(item, []).map((option) => option.value)).toEqual([
      'light',
      'dark',
      'system',
    ]);
  });
});
