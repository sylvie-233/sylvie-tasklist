import path from 'node:path';

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  // 打包产物目录（默认 out/，改用 dist/ 与常见习惯一致）
  outDir: 'dist',
  packagerConfig: {
    asar: true,
    executableName: 'SylvieTaskList',
    icon: path.resolve(__dirname, 'assets/icon'),
    win32metadata: {
      CompanyName: 'Sylvie',
      FileDescription: 'Sylvie TaskList 本地任务清单',
      ProductName: 'Sylvie TaskList',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'sylvie_tasklist',
      setupExe: 'SylvieTaskList-Setup-${version}.exe',
      noMsi: true,
      setupIcon: path.resolve(__dirname, 'assets/icon.ico'),
    }),
    new MakerZIP({}, ['win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
  ],
};

export default config;
