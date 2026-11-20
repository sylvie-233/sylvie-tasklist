import type { JSX } from 'react';

import { Toaster as SonnerToaster } from 'sonner';
import 'sonner/dist/styles.css';

export interface ToasterProps {
  theme: 'light' | 'dark';
}

/** 轻提示：基于 sonner，固定在窗口底部居中。 */
export function Toaster({ theme }: ToasterProps): JSX.Element {
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-center"
      offset={34}
      gap={8}
      visibleToasts={2}
      duration={1800}
      toastOptions={{
        className: 'sylvie-toast',
        style: {
          fontSize: '12px',
          borderRadius: '5px',
          padding: '7px 14px',
        },
      }}
    />
  );
}
