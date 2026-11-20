import eslintConfigPrettier from 'eslint-config-prettier/flat';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './base.js';

/**
 * React + TypeScript 平面配置（浏览器环境）。
 * 渲染层与 UI 包共用；Electron 主进程沿用时 node globals 仍由 base 提供。
 * @type {import('eslint').Linter.Config[]}
 */
export default tseslint.config(
  ...base,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // props 由 TypeScript 约束，无需运行时 prop-types
      'react/prop-types': 'off',
    },
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  // React 插件会重新引入格式规则，Prettier 配置需再次置于末尾
  eslintConfigPrettier,
);
