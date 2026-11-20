import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // @sylvie/core 以 TS 源码形式被 workspace 内的应用消费，
    // 显式 alias 保证主进程打包时走源码而不是 node_modules 中的符号链接。
    alias: {
      '@sylvie/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
});
