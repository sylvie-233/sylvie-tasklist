import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { TaskListRepository } from './repository';
import { registerGroupTools } from './tools/groups';
import { registerOverviewTool } from './tools/overview';
import { registerSettingsTools } from './tools/settings';
import { registerTaskTools } from './tools/tasks';

export interface CreateMcpServerOptions {
  repo: TaskListRepository;
  version: string;
  /** 服务名，默认 sylvie-tasklist。 */
  name?: string;
}

const INSTRUCTIONS = [
  'Sylvie TaskList 本地任务清单服务。',
  '查询：list_tasks（多条件过滤）、get_task、get_overview、list_groups、get_settings。',
  '变更：create_task、update_task、set_task_done、delete_task、move_task、create_group、update_group、delete_group。',
  '约定：删除分组不会删除任务（任务归入「未分组」）；完成状态用 set_task_done 而不是 update_task。',
].join('\n');

/** 组装 MCP Server 并注册全部任务清单工具（与传输层无关）。 */
export function createTaskListMcpServer({
  repo,
  version,
  name = 'sylvie-tasklist',
}: CreateMcpServerOptions): McpServer {
  const server = new McpServer({ name, version }, { instructions: INSTRUCTIONS });

  registerTaskTools(server, repo);
  registerGroupTools(server, repo);
  registerOverviewTool(server, repo);
  registerSettingsTools(server, repo);

  return server;
}
