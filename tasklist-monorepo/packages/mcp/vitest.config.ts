import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * mcp 包以 TS 源码直接消费 @sylvie/core 与 @sylvie/utils，
 * 测试时用 alias 指向源码，避免走 node_modules 里的包入口。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@sylvie/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@sylvie/utils': fileURLToPath(new URL('../utils/src/index.ts', import.meta.url)),
    },
  },
});
