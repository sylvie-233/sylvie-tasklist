import { ipcMain } from 'electron';

import type { McpStatus } from '../../desktop-types';
import { state } from '../context';
import { applyMcpEnabled, currentMcpStatus, pushMcpStatus } from '../mcp/service';
import { ensureSettingsLoaded, persistSettings } from '../storage';

/** MCP 开关（立即生效）与状态查询。 */
export function registerMcpIpc(): void {
  ipcMain.handle('mcp:set-enabled', async (_event, enabled: unknown): Promise<McpStatus> => {
    const settings = await ensureSettingsLoaded();
    const next = { ...settings, 'mcp.serverEnabled': enabled === true };
    state.settings = next;
    await persistSettings(next);

    const status = await applyMcpEnabled(next['mcp.serverEnabled']);
    pushMcpStatus();
    return status;
  });

  ipcMain.handle('mcp:status', (): McpStatus => currentMcpStatus());
}
