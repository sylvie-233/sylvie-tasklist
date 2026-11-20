/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import type { DesktopApi } from './src/desktop-types';

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}
