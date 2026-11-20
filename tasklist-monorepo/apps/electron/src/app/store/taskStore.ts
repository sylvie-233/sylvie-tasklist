import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import {
  ALL_GROUP,
  DEFAULT_SETTINGS,
  UNGROUPED,
  migrateSettings,
  nextNewOrder,
  orderBetween,
  viewTasks,
} from '@sylvie/core';
import type {
  AppSettings,
  FilterMode,
  SettingKey,
  SortMode,
  Task,
  TaskData,
  TaskDraft,
  ViewState,
} from '@sylvie/core';
import { toast } from '@sylvie/ui';

import type { McpStatus } from '../../desktop-types';

export interface FlashState {
  id: number;
  done: boolean;
  token: number;
}

const DEFAULT_VIEW: ViewState = {
  group: ALL_GROUP,
  filter: 'all',
  sort: 'priority',
  search: '',
};

export interface TaskStore {
  data: TaskData;
  settings: AppSettings;
  view: ViewState;
  flash: FlashState | null;
  mcp: McpStatus;

  hydrate: (data: TaskData, settings: AppSettings) => void;
  replaceData: (data: TaskData) => void;
  replaceSettings: (settings: AppSettings) => void;
  setMcpStatus: (status: McpStatus) => void;

  setView: (patch: Partial<ViewState>) => void;
  setFilter: (filter: FilterMode) => void;
  setSort: (sort: SortMode) => void;

  addTask: (draft: TaskDraft) => void;
  updateTask: (id: number, draft: TaskDraft) => void;
  deleteTask: (id: number) => void;
  toggleTask: (id: number) => void;
  /** dnd-kit 拖拽结束：把 active 放到 over 的位置。 */
  moveTask: (activeId: number, overId: number) => void;
  moveTaskToGroup: (taskId: number, group: string) => void;

  addGroup: (name: string, color: string | null) => boolean;
  updateGroup: (oldName: string, newName: string, color: string | null) => boolean;
  deleteGroup: (name: string) => void;
  moveGroup: (activeName: string, overName: string) => void;

  updateSetting: <K extends SettingKey>(key: K, value: AppSettings[K]) => void;
  applySettings: (next: AppSettings) => void;
  resetSettings: () => void;
}

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    data: { groups: [], groupColors: {}, seq: 1, tasks: [] },
    settings: { ...DEFAULT_SETTINGS },
    view: DEFAULT_VIEW,
    flash: null,
    mcp: { running: false, port: null },

    hydrate: (data, settings) => set({ data, settings }),
    replaceData: (data) => set({ data }),
    replaceSettings: (settings) => set({ settings }),
    setMcpStatus: (mcp) => set({ mcp }),

    setView: (patch) => set((state) => ({ view: { ...state.view, ...patch } })),
    setFilter: (filter) => set((state) => ({ view: { ...state.view, filter } })),
    setSort: (sort) => set((state) => ({ view: { ...state.view, sort } })),

    addTask: (draft) =>
      set((state) => {
        const task: Task = {
          id: state.data.seq,
          createdAt: Date.now(),
          order: nextNewOrder(state.data.tasks),
          done: false,
          completedAt: null,
          ...draft,
        };
        toast.success('已创建任务');
        return {
          data: {
            ...state.data,
            seq: state.data.seq + 1,
            tasks: [...state.data.tasks, task],
          },
        };
      }),

    updateTask: (id, draft) =>
      set((state) => ({
        data: {
          ...state.data,
          tasks: state.data.tasks.map((task) => (task.id === id ? { ...task, ...draft } : task)),
        },
      })),

    deleteTask: (id) =>
      set((state) => ({
        data: { ...state.data, tasks: state.data.tasks.filter((task) => task.id !== id) },
      })),

    toggleTask: (id) => {
      const target = get().data.tasks.find((task) => task.id === id);
      if (!target) {
        return;
      }
      const nextDone = !target.done;
      set((state) => ({
        data: {
          ...state.data,
          tasks: state.data.tasks.map((task) =>
            task.id === id
              ? { ...task, done: nextDone, completedAt: nextDone ? Date.now() : null }
              : task,
          ),
        },
        flash: { id, done: nextDone, token: Date.now() },
      }));
      toast(nextDone ? `已完成「${target.title}」` : `已恢复「${target.title}」为进行中`);
    },

    moveTask: (activeId, overId) => {
      const { data, view } = get();
      if (activeId === overId) {
        return;
      }
      // 规则排序下拖拽：先切到自定义排序，保证“所见即所排”
      if (view.sort !== 'custom') {
        set({ view: { ...view, sort: 'custom' } });
        toast('已切换为「自定义排序」');
      }

      const currentView = get().view;
      const customList = viewTasks(data, { ...currentView, sort: 'custom' }, currentView.group);
      const ids = customList.map((task) => task.id);
      const fromIndex = ids.indexOf(activeId);
      const overIndex = ids.indexOf(overId);
      if (fromIndex < 0 || overIndex < 0) {
        return;
      }

      const nextIds = [...ids];
      nextIds.splice(fromIndex, 1);
      nextIds.splice(overIndex, 0, activeId);
      const position = nextIds.indexOf(activeId);
      const order = orderBetween(data.tasks, nextIds[position - 1], nextIds[position + 1]);
      if (order === null) {
        return;
      }

      set((state) => ({
        data: {
          ...state.data,
          tasks: state.data.tasks.map((task) => (task.id === activeId ? { ...task, order } : task)),
        },
      }));
    },

    moveTaskToGroup: (taskId, group) => {
      set((state) => ({
        data: {
          ...state.data,
          tasks: state.data.tasks.map((task) => (task.id === taskId ? { ...task, group } : task)),
        },
      }));
      toast(`已移动到「${group}」`);
    },

    addGroup: (name, color) => {
      const trimmed = name.trim();
      const { data } = get();
      if (!trimmed || trimmed === ALL_GROUP || trimmed === UNGROUPED || data.groups.includes(trimmed)) {
        return false;
      }
      set((state) => ({
        data: {
          ...state.data,
          groups: [...state.data.groups, trimmed],
          groupColors: color
            ? { ...state.data.groupColors, [trimmed]: color }
            : state.data.groupColors,
        },
      }));
      return true;
    },

    updateGroup: (oldName, newName, color) => {
      const trimmed = newName.trim();
      const { data } = get();
      if (!trimmed) {
        return false;
      }
      if (trimmed !== oldName && (trimmed === ALL_GROUP || data.groups.includes(trimmed))) {
        return false;
      }

      set((state) => {
        const groupColors = { ...state.data.groupColors };
        delete groupColors[oldName];
        if (color) {
          groupColors[trimmed] = color;
        }
        return {
          data: {
            ...state.data,
            groups: state.data.groups.map((group) => (group === oldName ? trimmed : group)),
            groupColors,
            tasks: state.data.tasks.map((task) =>
              task.group === oldName ? { ...task, group: trimmed } : task,
            ),
          },
          view: { ...state.view, group: state.view.group === oldName ? trimmed : state.view.group },
          settings:
            state.settings['task.defaultGroup'] === oldName
              ? { ...state.settings, 'task.defaultGroup': trimmed }
              : state.settings,
        };
      });
      return true;
    },

    deleteGroup: (name) => {
      set((state) => {
        const groupColors = { ...state.data.groupColors };
        delete groupColors[name];
        return {
          data: {
            ...state.data,
            groups: state.data.groups.filter((group) => group !== name),
            groupColors,
            tasks: state.data.tasks.map((task) =>
              task.group === name ? { ...task, group: UNGROUPED } : task,
            ),
          },
          view: { ...state.view, group: state.view.group === name ? ALL_GROUP : state.view.group },
          settings:
            state.settings['task.defaultGroup'] === name
              ? { ...state.settings, 'task.defaultGroup': UNGROUPED }
              : state.settings,
        };
      });
      toast('分组已删除，任务归入「未分组」');
    },

    moveGroup: (activeName, overName) =>
      set((state) => {
        if (activeName === overName) {
          return state;
        }
        const groups = [...state.data.groups];
        const from = groups.indexOf(activeName);
        const to = groups.indexOf(overName);
        if (from < 0 || to < 0) {
          return state;
        }
        groups.splice(from, 1);
        groups.splice(to, 0, activeName);
        return { data: { ...state.data, groups } };
      }),

    updateSetting: (key, value) => {
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
      if (key === 'mcp.serverEnabled') {
        const enabled = value === true;
        void window.desktop
          .setMcpEnabled(enabled)
          .then((status) => get().setMcpStatus(status))
          .catch(() => toast.error('MCP Server 切换失败'));
      }
    },

    applySettings: (next) => {
      set({ settings: migrateSettings(next) });
      toast.success('设置已保存');
    },

    resetSettings: () => {
      set({ settings: { ...DEFAULT_SETTINGS } });
      toast.success('已恢复默认设置');
    },
  })),
);
