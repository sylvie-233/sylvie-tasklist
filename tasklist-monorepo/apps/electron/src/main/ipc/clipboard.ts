import { clipboard, ipcMain } from 'electron';

/** 写入系统剪贴板（渲染进程在 file:// 下不适合直接用 Clipboard API）。 */
export function registerClipboardIpc(): void {
  ipcMain.handle('clipboard:write-text', (_event, text: unknown): boolean => {
    if (typeof text !== 'string' || !text) {
      return false;
    }
    clipboard.writeText(text);
    return true;
  });
}
