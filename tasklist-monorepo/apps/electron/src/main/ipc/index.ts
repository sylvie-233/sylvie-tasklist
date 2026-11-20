import { registerClipboardIpc } from './clipboard';
import { registerFileIpc } from './files';
import { registerMcpIpc } from './mcp';
import { registerStorageIpc } from './storage';
import { registerWindowIpc } from './window';

/** 注册全部 IPC：按域拆分，入口只负责组装。 */
export function registerIpcHandlers(): void {
  registerStorageIpc();
  registerFileIpc();
  registerWindowIpc();
  registerMcpIpc();
  registerClipboardIpc();
}
