import { UNGROUPED } from './types';
import type { SettingKey } from './types';

/** 设置分类 id。 */
export type SettingCategoryId =
  | 'general'
  | 'appearance'
  | 'task'
  | 'mcp'
  | 'data'
  | 'json'
  | 'hotkeys';

/** 设置分类。顺序即左侧导航顺序（主流惯例：通用 → 外观 → 功能 → 数据 → 高级 → 参考）。 */
export const SETTINGS_CATEGORIES: ReadonlyArray<{ id: SettingCategoryId; name: string }> = [
  { id: 'general', name: '通用' },
  { id: 'appearance', name: '外观' },
  { id: 'task', name: '任务' },
  { id: 'mcp', name: 'MCP 服务' },
  { id: 'data', name: '数据与备份' },
  { id: 'json', name: '配置文件' },
  { id: 'hotkeys', name: '快捷键' },
];

export interface SettingOption {
  value: string;
  label: string;
}

interface SettingItemBase {
  cat: SettingCategoryId;
  key: SettingKey;
  title: string;
  desc: string;
}

export interface SettingSelectItem extends SettingItemBase {
  type: 'select';
  /** 静态选项；`dynamic: 'group'` 时由分组列表动态生成。 */
  options?: ReadonlyArray<SettingOption>;
  dynamic?: 'group';
}

export interface SettingToggleItem extends SettingItemBase {
  type: 'checkbox' | 'switch';
}

export type SettingItem = SettingSelectItem | SettingToggleItem;

/** 设置项定义（键名走点分命名空间，与 settings.json 一致）。 */
export const SETTINGS_ITEMS: ReadonlyArray<SettingItem> = [
  {
    cat: 'general',
    key: 'window.closeAction',
    title: '点击关闭按钮时',
    desc: '点击标题栏 ✕ 按钮时最小化到系统托盘，或直接退出应用',
    type: 'select',
    options: [
      { value: 'tray', label: '最小化到系统托盘' },
      { value: 'quit', label: '退出应用' },
    ],
  },
  {
    cat: 'appearance',
    key: 'appearance.theme',
    title: '主题',
    desc: '控制应用界面的配色方案，“跟随系统”将自动匹配 Windows 的深浅色模式',
    type: 'select',
    options: [
      { value: 'light', label: '亮色' },
      { value: 'dark', label: '暗色' },
      { value: 'system', label: '跟随系统' },
    ],
  },
  {
    cat: 'appearance',
    key: 'appearance.fontSize',
    title: '界面字号',
    desc: '调整整个应用界面的显示大小，重启后仍会保留',
    type: 'select',
    options: [
      { value: 'small', label: '小 (90%)' },
      { value: 'standard', label: '标准 (100%)' },
      { value: 'large', label: '大 (110%)' },
    ],
  },
  {
    cat: 'task',
    key: 'task.defaultGroup',
    title: '默认分组',
    desc: '新建任务时默认选择的分组（当前侧边栏选中分组时优先使用当前分组）',
    type: 'select',
    dynamic: 'group',
  },
  {
    cat: 'task',
    key: 'task.defaultPriority',
    title: '默认优先级',
    desc: '新建任务时默认选择的优先级',
    type: 'select',
    options: [
      { value: 'high', label: '高' },
      { value: 'mid', label: '中' },
      { value: 'low', label: '低' },
    ],
  },
  {
    cat: 'task',
    key: 'task.overdueHighlight',
    title: '逾期任务高亮',
    desc: '超过截止时间的未完成任务显示红色“已逾期”标记；关闭后仍展示普通截止时间',
    type: 'checkbox',
  },
  {
    cat: 'mcp',
    key: 'mcp.serverEnabled',
    title: '启动 MCP Server',
    desc: '在本机启动 MCP（Model Context Protocol）服务器，将任务数据通过标准协议暴露给 AI 助手等外部客户端，可查询任务、创建任务等。切换开关立即生效，无需重启',
    type: 'switch',
  },
];

/** 快捷键说明（设置页只读展示）。 */
export const HOTKEYS: ReadonlyArray<{ name: string; keys: string }> = [
  { name: '新建任务', keys: 'Ctrl + N' },
  { name: '聚焦搜索框', keys: 'Ctrl + F' },
  { name: '打开设置', keys: 'Ctrl + ,' },
  { name: '关闭弹窗 / 菜单', keys: 'Esc' },
];

/** 取某个设置项的可选项（动态分组项始终包含「未分组」）。 */
export function resolveSettingOptions(item: SettingItem, groups: string[]): SettingOption[] {
  if (item.type !== 'select') {
    return [];
  }
  if (item.dynamic === 'group') {
    return [
      ...groups.map((g) => ({ value: g, label: g })),
      { value: UNGROUPED, label: UNGROUPED },
    ];
  }
  return [...(item.options ?? [])];
}
