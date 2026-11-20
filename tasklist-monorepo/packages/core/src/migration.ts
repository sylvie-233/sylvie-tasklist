import { DEFAULT_GROUPS, DEFAULT_SETTINGS, LEGACY_SETTING_KEYS } from './defaults';
import type { AppSettings, Priority, Task, TaskData } from './types';
import { UNGROUPED } from './types';

const PRIORITIES: readonly Priority[] = ['high', 'mid', 'low'];

const THEME_VALUES = ['light', 'dark', 'system'] as const;
const FONT_SIZE_VALUES = ['small', 'standard', 'large'] as const;
const CLOSE_ACTION_VALUES = ['tray', 'quit'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * 时间字段命名历史兼容：`due` → `dueAt`，`created` → `createdAt`。
 * 纯日期补 `T09:00`（历史数据只有日期，补一个默认时刻，用户可在编辑中调整）。
 */
function normalizeDueAt(raw: Record<string, unknown>): string {
  const value = asString(raw.dueAt) || asString(raw.due);
  if (!value) {
    return '';
  }
  if (ISO_DATE_TIME.test(value)) {
    return value;
  }
  if (ISO_DATE.test(value)) {
    return `${value}T09:00`;
  }
  return '';
}

function normalizeTask(raw: unknown, fallbackId: number): Task | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const title = asString(record.title).trim();
  if (!title) {
    return null;
  }

  const idRaw = record.id;
  const id = typeof idRaw === 'number' && Number.isFinite(idRaw) ? idRaw : fallbackId;

  const createdAtRaw = record.createdAt ?? record.created;
  const createdAt =
    typeof createdAtRaw === 'number' && Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now();

  const orderRaw = record.order;
  const order =
    typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? orderRaw : undefined;

  const completedAtRaw = record.completedAt;
  const completedAt =
    typeof completedAtRaw === 'number' && Number.isFinite(completedAtRaw) ? completedAtRaw : null;

  const priorityRaw = record.priority;
  const priority = PRIORITIES.includes(priorityRaw as Priority)
    ? (priorityRaw as Priority)
    : 'mid';

  const task: Task = {
    id,
    createdAt,
    done: asBoolean(record.done, false),
    completedAt,
    title,
    note: asString(record.note),
    group: asString(record.group) || UNGROUPED,
    priority,
    dueAt: normalizeDueAt(record),
  };
  if (order !== undefined) {
    task.order = order;
  }
  return task;
}

/**
 * 容错解析 `tasks.json`：
 * - 缺字段补默认值，未知字段丢弃；
 * - 归属到不存在分组的任务归入「未分组」；
 * - 无标题的坏任务直接丢弃，避免整份文件不可用。
 */
export function migrateTaskData(raw: unknown): TaskData {
  const record = asRecord(raw);
  if (!record) {
    return { groups: [...DEFAULT_GROUPS], groupColors: {}, seq: 1, tasks: [] };
  }

  const rawGroups = Array.isArray(record.groups) ? record.groups : [];
  const groups: string[] = [];
  for (const item of rawGroups) {
    const name = asString(item).trim();
    if (!name || name === UNGROUPED || name === '全部' || groups.includes(name)) {
      continue;
    }
    groups.push(name);
  }
  if (groups.length === 0) {
    groups.push(...DEFAULT_GROUPS);
  }

  const rawColors = asRecord(record.groupColors);
  const groupColors: Record<string, string> = {};
  if (rawColors) {
    for (const [name, value] of Object.entries(rawColors)) {
      if (groups.includes(name) && typeof value === 'string' && value) {
        groupColors[name] = value;
      }
    }
  }

  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const tasks: Task[] = [];
  rawTasks.forEach((item, index) => {
    const task = normalizeTask(item, index + 1);
    if (!task) {
      return;
    }
    if (task.group !== UNGROUPED && !groups.includes(task.group)) {
      task.group = UNGROUPED;
    }
    tasks.push(task);
  });

  const maxId = tasks.reduce((max, task) => Math.max(max, task.id), 0);
  const rawSeq = record.seq;
  const seq =
    typeof rawSeq === 'number' && Number.isFinite(rawSeq)
      ? Math.max(Math.trunc(rawSeq), maxId + 1)
      : maxId + 1;

  return { groups, groupColors, seq, tasks };
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * 容错解析 `settings.json`：
 * - 仅识别合法配置键，未知键忽略；
 * - 旧版扁平键（`theme` 等）自动映射到命名空间键；
 * - 值类型/枚举不合法时回退默认值。
 */
export function migrateSettings(raw: unknown): AppSettings {
  const record = asRecord(raw);
  const migrated: Record<string, unknown> = record ? { ...record } : {};

  for (const [legacyKey, nextKey] of Object.entries(LEGACY_SETTING_KEYS)) {
    if (legacyKey in migrated && !(nextKey in migrated)) {
      migrated[nextKey] = migrated[legacyKey];
    }
  }

  const defaultGroupRaw = migrated['task.defaultGroup'];
  const defaultGroup =
    typeof defaultGroupRaw === 'string' && defaultGroupRaw.trim()
      ? defaultGroupRaw.trim()
      : DEFAULT_SETTINGS['task.defaultGroup'];

  return {
    'appearance.theme': pickEnum(
      migrated['appearance.theme'],
      THEME_VALUES,
      DEFAULT_SETTINGS['appearance.theme'],
    ),
    'appearance.fontSize': pickEnum(
      migrated['appearance.fontSize'],
      FONT_SIZE_VALUES,
      DEFAULT_SETTINGS['appearance.fontSize'],
    ),
    'window.closeAction': pickEnum(
      migrated['window.closeAction'],
      CLOSE_ACTION_VALUES,
      DEFAULT_SETTINGS['window.closeAction'],
    ),
    'task.defaultGroup': defaultGroup,
    'task.defaultPriority': pickEnum(
      migrated['task.defaultPriority'],
      PRIORITIES,
      DEFAULT_SETTINGS['task.defaultPriority'],
    ),
    'task.overdueHighlight': asBoolean(
      migrated['task.overdueHighlight'],
      DEFAULT_SETTINGS['task.overdueHighlight'],
    ),
    'mcp.serverEnabled': asBoolean(
      migrated['mcp.serverEnabled'],
      DEFAULT_SETTINGS['mcp.serverEnabled'],
    ),
  };
}

/** 以固定字段顺序输出配置，保证 settings.json 编辑器里排版稳定。 */
export function serializeSettings(settings: AppSettings): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    ordered[key] = settings[key];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
