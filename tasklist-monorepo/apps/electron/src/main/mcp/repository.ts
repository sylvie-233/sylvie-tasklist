import { UNGROUPED, nextNewOrder, orderForPosition } from '@sylvie/core';
import type { AppSettings, Priority, Task, TaskData } from '@sylvie/core';
import { normalizeDueInput } from '@sylvie/utils';
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskListRepository,
  UpdateTaskInput,
} from '@sylvie/mcp';

export interface TaskRepositoryContext {
  getTasks(): TaskData;
  /** 写入并持久化 / 广播变更。 */
  commitTasks(next: TaskData): void;
  getSettings(): AppSettings;
  commitSettings(next: AppSettings): void;
}

const DEFAULT_PRIORITY: Priority = 'mid';

function parseColor(color: string | null | undefined): string | null {
  if (color === undefined || color === null || color === '') {
    return null;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`颜色格式不合法：${color}（应为 #RRGGBB）`);
  }
  return color.toLowerCase();
}

/**
 * 把主进程的任务缓存适配成 MCP 的 TaskListRepository：
 * 所有写操作都经过 `commitTasks` / `commitSettings`（原子落盘 + 通知渲染进程）。
 */
export function createTaskListRepository(ctx: TaskRepositoryContext): TaskListRepository {
  const ensureGroup = (data: TaskData, group: string): string => {
    const trimmed = group.trim();
    if (!trimmed) {
      return UNGROUPED;
    }
    if (trimmed === UNGROUPED || data.groups.includes(trimmed)) {
      return trimmed;
    }
    throw new Error(`分组不存在：${trimmed}。可用分组：${[...data.groups, UNGROUPED].join('、')}`);
  };

  const findTask = (data: TaskData, id: number): Task => {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error(`任务不存在：id=${id}`);
    }
    return task;
  };

  return {
    getData: () => ctx.getTasks(),
    getSettings: () => ctx.getSettings(),

    createTask(input: CreateTaskInput): Task {
      const data = ctx.getTasks();
      const title = input.title.trim();
      if (!title) {
        throw new Error('标题不能为空');
      }
      const defaultGroup = ctx.getSettings()['task.defaultGroup'];
      const group = ensureGroup(data, input.group ?? defaultGroup);

      const task: Task = {
        id: data.seq,
        createdAt: Date.now(),
        order: nextNewOrder(data.tasks),
        done: false,
        completedAt: null,
        title,
        note: input.note ?? '',
        group,
        priority: input.priority ?? DEFAULT_PRIORITY,
        dueAt: normalizeDueInput(input.dueAt ?? ''),
      };

      ctx.commitTasks({ ...data, seq: data.seq + 1, tasks: [...data.tasks, task] });
      return task;
    },

    updateTask(id: number, input: UpdateTaskInput): Task {
      const data = ctx.getTasks();
      const current = findTask(data, id);

      const next: Task = { ...current };
      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) {
          throw new Error('标题不能为空');
        }
        next.title = title;
      }
      if (input.note !== undefined) {
        next.note = input.note;
      }
      if (input.group !== undefined) {
        next.group = ensureGroup(data, input.group);
      }
      if (input.priority !== undefined) {
        next.priority = input.priority;
      }
      if (input.dueAt !== undefined) {
        next.dueAt = normalizeDueInput(input.dueAt);
      }

      ctx.commitTasks({
        ...data,
        tasks: data.tasks.map((task) => (task.id === id ? next : task)),
      });
      return next;
    },

    setTaskDone(id: number, done: boolean): Task {
      const data = ctx.getTasks();
      const current = findTask(data, id);
      if (current.done === done) {
        return current;
      }
      const next: Task = { ...current, done, completedAt: done ? Date.now() : null };
      ctx.commitTasks({
        ...data,
        tasks: data.tasks.map((task) => (task.id === id ? next : task)),
      });
      return next;
    },

    deleteTask(id: number): void {
      const data = ctx.getTasks();
      findTask(data, id);
      ctx.commitTasks({ ...data, tasks: data.tasks.filter((task) => task.id !== id) });
    },

    moveTask(id: number, input: MoveTaskInput): Task {
      const data = ctx.getTasks();
      const current = findTask(data, id);

      let group = current.group;
      if (input.group !== undefined) {
        group = ensureGroup(data, input.group);
      }

      let order = current.order;
      const targetId = input.beforeId ?? input.afterId;
      if (targetId !== undefined) {
        if (targetId === id) {
          throw new Error('不能相对自己移动');
        }
        findTask(data, targetId);
        const computed = orderForPosition(
          data.tasks,
          id,
          targetId,
          input.beforeId !== undefined ? 'before' : 'after',
        );
        if (computed === null) {
          throw new Error('顺序计算失败');
        }
        order = computed;
      }

      const next: Task = { ...current, group, ...(order === undefined ? {} : { order }) };
      ctx.commitTasks({
        ...data,
        tasks: data.tasks.map((task) => (task.id === id ? next : task)),
      });
      return next;
    },

    createGroup(name: string, color?: string) {
      const data = ctx.getTasks();
      const trimmed = name.trim();
      if (!trimmed || trimmed === UNGROUPED || trimmed === '全部') {
        throw new Error(`分组名不合法：${name}`);
      }
      if (data.groups.includes(trimmed)) {
        throw new Error(`分组已存在：${trimmed}`);
      }
      const parsed = parseColor(color);
      const groupColors = { ...data.groupColors };
      if (parsed) {
        groupColors[trimmed] = parsed;
      }
      ctx.commitTasks({ ...data, groups: [...data.groups, trimmed], groupColors });
      return { name: trimmed, color: parsed, total: 0, active: 0, done: 0 };
    },

    updateGroup(name: string, patch: { name?: string; color?: string | null }) {
      const data = ctx.getTasks();
      if (!data.groups.includes(name)) {
        throw new Error(`分组不存在：${name}`);
      }
      const nextName = patch.name?.trim() ?? name;
      if (!nextName || nextName === UNGROUPED || nextName === '全部') {
        throw new Error(`分组名不合法：${nextName}`);
      }
      if (nextName !== name && data.groups.includes(nextName)) {
        throw new Error(`分组已存在：${nextName}`);
      }

      const groupColors = { ...data.groupColors };
      const previousColor = groupColors[name];
      delete groupColors[name];
      const nextColor =
        patch.color === undefined ? (previousColor ?? null) : parseColor(patch.color);
      if (nextColor) {
        groupColors[nextName] = nextColor;
      }

      ctx.commitTasks({
        ...data,
        groups: data.groups.map((group) => (group === name ? nextName : group)),
        groupColors,
        tasks: data.tasks.map((task) =>
          task.group === name ? { ...task, group: nextName } : task,
        ),
      });

      if (nextName !== name) {
        const settings = ctx.getSettings();
        if (settings['task.defaultGroup'] === name) {
          ctx.commitSettings({ ...settings, 'task.defaultGroup': nextName });
        }
      }

      const scoped = ctx.getTasks().tasks.filter((task) => task.group === nextName);
      return {
        name: nextName,
        color: nextColor,
        total: scoped.length,
        active: scoped.filter((task) => !task.done).length,
        done: scoped.filter((task) => task.done).length,
      };
    },

    deleteGroup(name: string): number {
      const data = ctx.getTasks();
      if (!data.groups.includes(name)) {
        throw new Error(`分组不存在：${name}`);
      }
      const moved = data.tasks.filter((task) => task.group === name).length;
      const groupColors = { ...data.groupColors };
      delete groupColors[name];

      ctx.commitTasks({
        ...data,
        groups: data.groups.filter((group) => group !== name),
        groupColors,
        tasks: data.tasks.map((task) =>
          task.group === name ? { ...task, group: UNGROUPED } : task,
        ),
      });

      const settings = ctx.getSettings();
      if (settings['task.defaultGroup'] === name) {
        ctx.commitSettings({ ...settings, 'task.defaultGroup': UNGROUPED });
      }
      return moved;
    },
  };
}
