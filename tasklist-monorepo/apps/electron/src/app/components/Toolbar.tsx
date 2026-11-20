import type { JSX } from 'react';

import type { FilterMode, SortMode } from '@sylvie/core';
import { Button, Select, TextInput } from '@sylvie/ui';

import { useTaskStore } from '../store/taskStore';

const FILTERS: Array<{ value: FilterMode; label: string; title: string }> = [
  { value: 'all', label: '全部', title: '显示全部任务' },
  { value: 'active', label: '进行中', title: '只显示未完成的任务' },
  { value: 'done', label: '已完成', title: '只显示已完成的任务' },
];

const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: 'custom', label: '自定义排序' },
  { value: 'priority', label: '按优先级' },
  { value: 'due', label: '按截止时间' },
  { value: 'created', label: '按创建时间' },
];

interface ToolbarProps {
  onNewTask: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

/** 内容区工具行：搜索 + 筛选 + 排序 + 新建。 */
export function Toolbar({ onNewTask, searchRef }: ToolbarProps): JSX.Element {
  const view = useTaskStore((state) => state.view);
  const setView = useTaskStore((state) => state.setView);
  const setFilter = useTaskStore((state) => state.setFilter);
  const setSort = useTaskStore((state) => state.setSort);

  return (
    <div className="toolbar">
      <TextInput
        ref={searchRef}
        type="search"
        className="toolbar-search"
        placeholder="搜索任务… (Ctrl+F)"
        title="按标题和备注搜索任务 (Ctrl+F)"
        value={view.search}
        onChange={(event) => setView({ search: event.target.value })}
      />
      <div className="filter-tabs">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`filter-tab${view.filter === filter.value ? ' active' : ''}`}
            title={filter.title}
            onClick={() => setFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <Select
        className="toolbar-sort"
        value={view.sort}
        title="任务排序方式"
        onChange={(event) => setSort(event.target.value as SortMode)}
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </Select>
      <Button variant="primary" title="新建任务 (Ctrl+N)" onClick={onNewTask}>
        + 新建任务
      </Button>
    </div>
  );
}
