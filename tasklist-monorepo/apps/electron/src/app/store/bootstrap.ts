import { debounce } from 'perfect-debounce';

import type { AppSettings, TaskData } from '@sylvie/core';

import { useTaskStore } from './taskStore';
import type { LoadResult } from '../../desktop-types';

const saveTasks = debounce((data: TaskData) => {
  void window.desktop.saveTasks(data).catch((error: unknown) => {
    console.error('[store] 保存 tasks.json 失败', error);
  });
}, 300);

const saveSettings = debounce((settings: AppSettings) => {
  void window.desktop.saveSettings(settings).catch((error: unknown) => {
    console.error('[store] 保存 settings.json 失败', error);
  });
}, 200);

/** 订阅数据变更并防抖落盘；相同内容不重复写入（避免 MCP 回写造成的回声）。 */
function startPersistence(): void {
  let lastTasks = JSON.stringify(useTaskStore.getState().data);
  let lastSettings = JSON.stringify(useTaskStore.getState().settings);

  useTaskStore.subscribe(
    (state) => state.data,
    (data) => {
      const serialized = JSON.stringify(data);
      if (serialized === lastTasks) {
        return;
      }
      lastTasks = serialized;
      saveTasks(data);
    },
  );

  useTaskStore.subscribe(
    (state) => state.settings,
    (settings) => {
      const serialized = JSON.stringify(settings);
      if (serialized === lastSettings) {
        return;
      }
      lastSettings = serialized;
      saveSettings(settings);
    },
  );
}

/** 启动时加载数据、接上落盘与主进程事件。 */
export async function bootstrapStore(): Promise<LoadResult> {
  const result = await window.desktop.loadAll();
  useTaskStore.getState().hydrate(result.tasks, result.settings);

  startPersistence();

  window.desktop.onMcpStatus((status) => useTaskStore.getState().setMcpStatus(status));
  window.desktop.onTasksChanged((data) => useTaskStore.getState().replaceData(data));

  const status = await window.desktop.getMcpStatus();
  useTaskStore.getState().setMcpStatus(status);

  return result;
}
