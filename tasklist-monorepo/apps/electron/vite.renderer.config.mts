import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@sylvie/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@sylvie/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
    },
    // 共享包（@sylvie/core）各自声明了 React 依赖时，强制解析到同一份 React，
    // 避免打包后出现 “Invalid hook call”。
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
