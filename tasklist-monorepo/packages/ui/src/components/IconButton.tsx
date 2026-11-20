import type { JSX } from 'react';

import { cn } from '../lib/cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** hover 色调，默认主题色；danger 用于删除类操作。 */
  tone?: 'default' | 'danger';
}

/** 图标按钮（无文字，必须有 title 供悬停提示与无障碍）。 */
export function IconButton({
  tone = 'default',
  className,
  type = 'button',
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cn('icon-btn', tone === 'danger' && 'icon-btn-danger', className)}
      {...rest}
    />
  );
}
