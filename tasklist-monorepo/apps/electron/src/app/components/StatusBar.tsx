import type { JSX } from 'react';

import { scopeLabel, taskStats, viewTasks } from '@sylvie/core';

import type { AppInfo } from '../../desktop-types';
import { useTaskStore } from '../store/taskStore';

interface StatusBarProps {
  info: AppInfo;
}

/** 底部状态栏：统计口径与右侧列表完全一致 + MCP 运行指示 + 版本号。 */
export function StatusBar({ info }: StatusBarProps): JSX.Element {
  const data = useTaskStore((state) => state.data);
  const view = useTaskStore((state) => state.view);
  const mcp = useTaskStore((state) => state.mcp);
  const stats = taskStats(viewTasks(data, view, view.group));

  return (
    <footer className="statusbar">
      <span>
        {scopeLabel(view.group)}：共 {stats.total} 个任务，{stats.active} 个进行中，{stats.done}{' '}
        个已完成
      </span>
      <span className="spacer" />
      {mcp.running && (
        <span
          className="mcp-indicator"
          title={`MCP Server 运行中（127.0.0.1:${mcp.port ?? '-'}）· 设置 → MCP 服务中可开关`}
        >
          <span className="mcp-dot" />
          MCP 已开启
        </span>
      )}
      <span>v{info.version}</span>
    </footer>
  );
}
