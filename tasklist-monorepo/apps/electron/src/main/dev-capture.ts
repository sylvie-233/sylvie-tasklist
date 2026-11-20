import { writeFile } from 'node:fs/promises';

import { app, type BrowserWindow } from 'electron';

/**
 * 开发调试用截图钩子（不影响正常启动）：
 *
 * ```bash
 * TASKLIST_CAPTURE=out.png pnpm desktop:dev                              # 主界面
 * TASKLIST_CAPTURE=out.png TASKLIST_CAPTURE_VIEW=settings pnpm desktop:dev  # 设置页
 * TASKLIST_CAPTURE=out.png TASKLIST_CAPTURE_VIEW=settings \
 *   TASKLIST_CAPTURE_CATEGORY=配置文件 pnpm desktop:dev                     # 指定设置分类
 * TASKLIST_CAPTURE=out.png TASKLIST_CAPTURE_VIEW=task pnpm desktop:dev      # 任务详情
 * ```
 *
 * 渲染完成后截图并退出，便于在没有 UI 自动化时检查界面回归。
 */
export function attachDevCapture(window: BrowserWindow): void {
  const target = process.env.TASKLIST_CAPTURE;
  if (!target) {
    return;
  }

  const view = process.env.TASKLIST_CAPTURE_VIEW;

  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        if (view === 'settings') {
          await window.webContents.executeJavaScript(
            "window.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true}))",
          );
          await new Promise((resolve) => setTimeout(resolve, 900));
          const category = process.env.TASKLIST_CAPTURE_CATEGORY;
          if (category) {
            await window.webContents.executeJavaScript(`
              (() => {
                const name = ${JSON.stringify(category)};
                const item = [...document.querySelectorAll('.settings-nav .nav-item')]
                  .find((el) => el.textContent?.trim() === name);
                item?.click();
              })()
            `);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else if (view === 'task') {
          await window.webContents.executeJavaScript(
            "document.querySelector('.task .task-body')?.click()",
          );
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        const image = await window.webContents.capturePage();
        await writeFile(target, image.toPNG());
        app.quit();
      })();
    }, 2000);
  });
}
