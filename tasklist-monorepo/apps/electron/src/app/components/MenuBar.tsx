import { useEffect, useRef, useState, type JSX } from 'react';

interface MenuBarProps {
  onNewTask: () => void;
  onNewGroup: () => void;
  onOpenSettings: () => void;
  onAbout: () => void;
}

type MenuId = 'task' | 'help';

/** 精简菜单栏：只管“创建”和“帮助”，配置类功能收口到设置界面。 */
export function MenuBar({
  onNewTask,
  onNewGroup,
  onOpenSettings,
  onAbout,
}: MenuBarProps): JSX.Element {
  const [open, setOpen] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (!barRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = (action: () => void): void => {
    setOpen(null);
    action();
  };

  return (
    <nav className="menubar" ref={barRef}>
      <div
        className={`menu-item${open === 'task' ? ' open' : ''}`}
        onMouseEnter={() => open && setOpen('task')}
      >
        <button
          type="button"
          className="menu-label"
          onClick={() => setOpen(open === 'task' ? null : 'task')}
        >
          任务
        </button>
        {open === 'task' && (
          <div className="dropdown">
            <button type="button" className="entry" onClick={() => run(onNewTask)}>
              新建任务 <span className="shortcut">Ctrl+N</span>
            </button>
            <button type="button" className="entry" onClick={() => run(onNewGroup)}>
              新建分组
            </button>
          </div>
        )}
      </div>

      <div
        className={`menu-item${open === 'help' ? ' open' : ''}`}
        onMouseEnter={() => open && setOpen('help')}
      >
        <button
          type="button"
          className="menu-label"
          onClick={() => setOpen(open === 'help' ? null : 'help')}
        >
          帮助
        </button>
        {open === 'help' && (
          <div className="dropdown">
            <button type="button" className="entry" onClick={() => run(onOpenSettings)}>
              设置 <span className="shortcut">Ctrl+,</span>
            </button>
            <button type="button" className="entry" onClick={() => run(onAbout)}>
              关于 Sylvie TaskList
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
