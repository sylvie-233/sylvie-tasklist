import type { CSSProperties, JSX, ReactNode } from 'react';

import { cn } from '../lib/cn';

export type ChipTone = 'default' | 'ghost' | 'high' | 'mid' | 'low' | 'overdue' | 'done';

export interface ChipProps {
  tone?: ChipTone;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}

/** 小标签：优先级 / 分组 / 时间 / 状态。 */
export function Chip({
  tone = 'default',
  className,
  style,
  title,
  children,
}: ChipProps): JSX.Element {
  return (
    <span
      className={cn('chip', tone !== 'default' && `chip--${tone}`, className)}
      style={style}
      title={title}
    >
      {children}
    </span>
  );
}
