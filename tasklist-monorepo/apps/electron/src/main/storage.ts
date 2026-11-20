import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSampleTaskData, migrateSettings, migrateTaskData } from '@sylvie/core';
import type { AppSettings, TaskData } from '@sylvie/core';

import { getPaths, state } from './context';

/** 读取 JSON；文件缺失或内容损坏时返回 null，交由调用方降级。 */
export async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** 原子写入：先写临时文件再 rename，避免中途崩溃写坏数据。 */
export async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

/** 加载并归一化 tasks.json；首次启动写入示例数据。 */
export async function ensureTasksLoaded(): Promise<TaskData> {
  if (state.tasks) {
    return state.tasks;
  }
  const { tasksPath } = getPaths();
  const raw = await readJsonFile(tasksPath);
  state.tasks = raw === null ? createSampleTaskData() : migrateTaskData(raw);
  await writeJsonAtomic(tasksPath, state.tasks);
  return state.tasks;
}

/** 加载并归一化 settings.json，缺失时写入默认配置。 */
export async function ensureSettingsLoaded(): Promise<AppSettings> {
  if (state.settings) {
    return state.settings;
  }
  const { settingsPath } = getPaths();
  const raw = await readJsonFile(settingsPath);
  state.settings = migrateSettings(raw);
  await writeJsonAtomic(settingsPath, state.settings);
  return state.settings;
}

export async function persistTasks(data: TaskData): Promise<void> {
  await writeJsonAtomic(getPaths().tasksPath, data);
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  await writeJsonAtomic(getPaths().settingsPath, settings);
}
