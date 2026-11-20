import { ipcMain } from 'electron';

import { state } from '../context';

/** 自定义标题栏的窗口控制（最小化 / 最大化切换 / 关闭）。 */
export function registerWindowIpc(): void {
  ipcMain.on('window:minimize', () => state.window?.minimize());

  ipcMain.on('window:toggle-maximize', () => {
    const window = state.window;
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on('window:close', () => state.window?.close());
}
