import { writeFile } from 'node:fs/promises';

import { app, type BrowserWindow } from 'electron';

/**
 * 开发调试用截图钩子（不影响正常启动）：
 *
 * ```bash
 * TASKLIST_CAPTURE=out.png TASKLIST_CAPTURE_SETTINGS=1 pnpm desktop:dev
 * ```
 *
 * 渲染完成后截图并退出，便于在没有 UI 自动化时检查界面回归。
 */
export function attachDevCapture(window: BrowserWindow): void {
  const target = process.env.TASKLIST_CAPTURE;
  if (!target) {
    return;
  }

  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        if (process.env.TASKLIST_CAPTURE_SETTINGS) {
          await window.webContents.executeJavaScript(
            "window.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true}))",
          );
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        const image = await window.webContents.capturePage();
        await writeFile(target, image.toPNG());
        app.quit();
      })();
    }, 2000);
  });
}
