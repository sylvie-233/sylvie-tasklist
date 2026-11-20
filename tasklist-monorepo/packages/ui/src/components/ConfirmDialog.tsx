import type { JSX, ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 确认弹窗：删除 / 覆盖 / 恢复默认等危险操作的二次确认。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onCancel()} title={title}>
      {description && <p className="dlg-body">{description}</p>}
      <div className="dlg-footer">
        {!hideCancel && (
          <Button title={cancelText} onClick={onCancel}>
            {cancelText}
          </Button>
        )}
        <Button
          variant={danger ? 'danger' : 'primary'}
          title={danger ? `${confirmText}（不可恢复）` : confirmText}
          onClick={onConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
