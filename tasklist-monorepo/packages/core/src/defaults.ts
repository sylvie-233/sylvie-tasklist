import type { AppSettings, Priority, TaskData } from './types';
import { UNGROUPED } from './types';

/** 预设分组颜色（创建/编辑分组时的色板）。 */
export const GROUP_PALETTE: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#e11d48', label: '玫瑰红' },
  { value: '#f59e0b', label: '琥珀' },
  { value: '#16a34a', label: '绿' },
  { value: '#0891b2', label: '青' },
  { value: '#2563eb', label: '蓝' },
  { value: '#7c3aed', label: '紫' },
  { value: '#db2777', label: '粉' },
  { value: '#64748b', label: '灰' },
];

/** 优先级文本。 */
export const PRIORITY_TEXT: Record<Priority, string> = {
  high: '高',
  mid: '中',
  low: '低',
};

/** 默认分组（仅首次启动写入示例数据时使用）。 */
export const DEFAULT_GROUPS = ['工作', '生活', '学习'];

/** 默认分组配色。 */
export const DEFAULT_GROUP_COLORS: Record<string, string> = {
  工作: '#2563eb',
  生活: '#16a34a',
  学习: '#7c3aed',
};

/** 空任务数据。 */
export function createEmptyTaskData(): TaskData {
  return {
    groups: [...DEFAULT_GROUPS],
    groupColors: { ...DEFAULT_GROUP_COLORS },
    seq: 1,
    tasks: [],
  };
}

/** 把“今天 + n 天”格式化为 ISO 日期（本地时区）。 */
function dayOffset(now: number, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 首次启动的示例任务，方便直接体验交互。 */
export function createSampleTaskData(now: number = Date.now()): TaskData {
  return {
    groups: [...DEFAULT_GROUPS],
    groupColors: { ...DEFAULT_GROUP_COLORS },
    seq: 5,
    tasks: [
      {
        id: 1,
        createdAt: now - 3_000,
        done: false,
        completedAt: null,
        title: '完成 v1 原型评审',
        note: '对照功能清单逐项确认',
        group: '工作',
        priority: 'high',
        dueAt: `${dayOffset(now, 1)}T18:00`,
      },
      {
        id: 2,
        createdAt: now - 2_000,
        done: false,
        completedAt: null,
        title: '搭建 Electron Forge 项目骨架',
        note: '',
        group: '工作',
        priority: 'mid',
        dueAt: `${dayOffset(now, 3)}T12:00`,
      },
      {
        id: 3,
        createdAt: now - 1_000,
        done: false,
        completedAt: null,
        title: '每周采购',
        note: '清单在冰箱上',
        group: '生活',
        priority: 'low',
        dueAt: `${dayOffset(now, 5)}T09:00`,
      },
      {
        id: 4,
        createdAt: now - 500,
        done: true,
        completedAt: now - 200,
        title: '确定技术栈：React + Electron Forge + Vite',
        note: '',
        group: '工作',
        priority: 'mid',
        dueAt: '',
      },
    ],
  };
}

/** 默认配置：与功能规划的设置项明细一一对应。 */
export const DEFAULT_SETTINGS: AppSettings = {
  'appearance.theme': 'light',
  'appearance.fontSize': 'standard',
  'window.closeAction': 'tray',
  'task.defaultGroup': DEFAULT_GROUPS[0] ?? UNGROUPED,
  'task.defaultPriority': 'mid',
  'task.overdueHighlight': true,
  'mcp.serverEnabled': false,
};

/** 旧版扁平配置键 → 命名空间键（平滑迁移用）。 */
export const LEGACY_SETTING_KEYS: Record<string, string> = {
  theme: 'appearance.theme',
  fontSize: 'appearance.fontSize',
  closeAction: 'window.closeAction',
  defaultGroup: 'task.defaultGroup',
  defaultPriority: 'task.defaultPriority',
  overdueHighlight: 'task.overdueHighlight',
  mcpEnabled: 'mcp.serverEnabled',
  serverEnabled: 'mcp.serverEnabled',
};
