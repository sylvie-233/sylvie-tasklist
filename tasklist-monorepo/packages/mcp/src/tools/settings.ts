import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { textResult } from '../format';
import type { TaskListRepository } from '../repository';

export function registerSettingsTools(server: McpServer, repo: TaskListRepository): void {
  server.registerTool(
    'get_settings',
    {
      title: '读取应用配置',
      description:
        '读取 settings.json 中的配置（主题、字号、关闭行为、默认分组/优先级、逾期高亮、MCP 开关）。修改配置请在应用设置界面操作。',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => textResult({ settings: repo.getSettings() }),
  );
}
