import path from 'node:path';

import { app, BrowserWindow, shell } from 'electron';

import { attachDevCapture } from './dev-capture';
import { broadcast, state } from './context';

/** 创建主窗口（无边框、单实例、按设置决定关闭行为）。 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    show: false,
    backgroundColor: '#f5f6f7',
    title: 'Sylvie TaskList',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.on('maximize', () => broadcast('window:maximized-changed', true));
  window.on('unmaximize', () => broadcast('window:maximized-changed', false));

  window.on('close', (event) => {
    if (state.quitting) {
      return;
    }
    // 关闭按钮行为由设置决定：最小化到托盘 / 直接退出
    if (state.settings?.['window.closeAction'] === 'tray' && state.tray) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on('closed', () => {
    state.window = null;
  });

  // 外链一律交给系统浏览器，禁止窗口内导航
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        event.preventDefault();
        window.webContents.toggleDevTools();
      }
    });
  }

  attachDevCapture(window);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

/** 显示并聚焦主窗口（最小化时先还原）；不存在则新建。 */
export function showMainWindow(): void {
  if (!state.window) {
    state.window = createMainWindow();
    return;
  }
  if (state.window.isMinimized()) {
    state.window.restore();
  }
  state.window.show();
  state.window.focus();
}
