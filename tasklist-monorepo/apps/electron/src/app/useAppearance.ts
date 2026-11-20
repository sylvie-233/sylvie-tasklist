import { useEffect, useState } from 'react';

import { useTaskStore } from './store/taskStore';

const FONT_ZOOM: Record<string, number> = { small: 0.9, standard: 1, large: 1.1 };

/**
 * 主题与字号：把 settings 映射到 `html.dark` 与 `--ui-zoom`，并监听系统深浅色变化。
 * 返回当前是否为暗色（供 sonner Toaster 使用）。
 */
export function useAppearance(): boolean {
  const theme = useTaskStore((state) => state.settings['appearance.theme']);
  const fontSize = useTaskStore((state) => state.settings['appearance.fontSize']);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    setSystemDark(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--ui-zoom',
      String(FONT_ZOOM[fontSize] ?? 1),
    );
  }, [fontSize]);

  return dark;
}
