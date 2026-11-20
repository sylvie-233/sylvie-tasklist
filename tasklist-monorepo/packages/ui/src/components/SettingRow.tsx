import type { JSX, ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** 搜索结果中显示的来源分类标签。 */
  category?: string;
  block?: boolean;
  children?: ReactNode;
}

/** 设置项行：左侧标题 + 说明，右侧控件。 */
export function SettingRow({
  title,
  description,
  category,
  block = false,
  children,
}: SettingRowProps): JSX.Element {
  return (
    <div className={cn('set-row', block && 'set-row--block')}>
      <div className="set-info">
        <div className="set-title">
          {title}
          {category && <span className="cat-tag">{category}</span>}
        </div>
        {description && <div className="set-desc">{description}</div>}
        {block && children}
      </div>
      {!block && children && <div className="set-ctrl">{children}</div>}
    </div>
  );
}

export interface HotkeyRowProps {
  name: string;
  keys: string;
}

export function HotkeyRow({ name, keys }: HotkeyRowProps): JSX.Element {
  return (
    <div className="hotkey-row">
      <span>{name}</span>
      <kbd>{keys}</kbd>
    </div>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  text: ReactNode;
}

export function EmptyState({ icon, text }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div>{text}</div>
    </div>
  );
}
