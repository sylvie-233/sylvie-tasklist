import type { ButtonHTMLAttributes, JSX } from 'react';

import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

/** 基础按钮：primary / secondary / danger / ghost。 */
export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cn('btn', `btn-${size}`, variant !== 'secondary' && `btn-${variant}`, block && 'btn-block', className)}
      {...rest}
    />
  );
}
