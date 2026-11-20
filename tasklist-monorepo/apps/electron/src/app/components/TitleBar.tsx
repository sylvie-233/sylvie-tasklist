import { useEffect, useState, type JSX } from 'react';

import { Copy, Minus, Square, X } from 'lucide-react';

import iconUrl from '../../../assets/icon.png';

/** 自定义标题栏（无边框窗口 + Windows 三键）。 */
export function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => window.desktop.onMaximizedChange(setMaximized), []);

  return (
    <header className="titlebar">
      <img className="app-icon" src={iconUrl} alt="" />
      <span className="app-name">Sylvie TaskList</span>
      <div className="win-drag" />
      <div className="win-controls">
        <button
          type="button"
          className="win-btn"
          title="最小化"
          onClick={() => window.desktop.minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? '向下还原' : '最大化'}
          onClick={() => window.desktop.toggleMaximize()}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          className="win-btn close"
          title="关闭"
          onClick={() => window.desktop.close()}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
