import path from 'node:path';

import { app, Menu, nativeImage, Tray } from 'electron';

import { state } from './context';
import { showMainWindow } from './window';

/**
 * 创建系统托盘：左键切换主窗口显隐，右键菜单可显示窗口或退出。
 * 关闭按钮的「最小化到托盘」行为依赖托盘存在。
 */
export function ensureTray(): void {
  if (state.tray) {
    return;
  }

  const iconPath = path.join(__dirname, '../../assets/tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(
    icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }),
  );

  tray.setToolTip('Sylvie TaskList');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          state.quitting = true;
          app.quit();
        },
      },
    ]),
  );

  tray.on('click', () => {
    if (!state.window) {
      showMainWindow();
      return;
    }
    if (state.window.isVisible() && !state.window.isMinimized()) {
      state.window.hide();
    } else {
      showMainWindow();
    }
  });

  state.tray = tray;
}
