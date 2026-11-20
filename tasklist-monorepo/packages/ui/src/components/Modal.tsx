import type { JSX, ReactNode } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../lib/cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  size?: ModalSize;
  /** 标题与关闭按钮之间的自定义内容（如设置页搜索框）。 */
  headerExtra?: ReactNode;
  hideClose?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * 弹窗基座：基于 Radix Dialog，自带焦点陷阱、Esc 关闭、点击遮罩关闭与进出场动画。
 */
export function Modal({
  open,
  onOpenChange,
  title,
  size = 'sm',
  headerExtra,
  hideClose = false,
  className,
  children,
}: ModalProps): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dlg-overlay" />
        <DialogPrimitive.Content
          className={cn('dlg-content', size !== 'sm' && `dlg-content--${size}`, className)}
        >
          <div className="dlg-head">
            {title ? (
              <DialogPrimitive.Title className="dlg-title">{title}</DialogPrimitive.Title>
            ) : (
              <DialogPrimitive.Title className="sr-only">对话框</DialogPrimitive.Title>
            )}
            {headerExtra}
            {!hideClose && (
              <DialogPrimitive.Close className="dlg-close" title="关闭 (Esc)" aria-label="关闭">
                <X size={15} />
              </DialogPrimitive.Close>
            )}
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
