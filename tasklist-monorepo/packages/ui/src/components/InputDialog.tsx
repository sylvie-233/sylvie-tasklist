import { useEffect, useState, type JSX } from 'react';

import { Button } from './Button';
import { ColorSwatches, type SwatchOption } from './ColorSwatches';
import { Field, TextInput } from './Field';
import { Modal } from './Modal';

export interface InputDialogProps {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  withColor?: boolean;
  colors?: ReadonlyArray<SwatchOption>;
  initialColor?: string | null;
  confirmText?: string;
  onSubmit: (value: string, color: string | null) => void;
  onCancel: () => void;
}

/** 单值输入弹窗（新建分组 / 编辑分组，可选颜色）。 */
export function InputDialog({
  open,
  title,
  label = '名称',
  placeholder,
  initialValue = '',
  withColor = false,
  colors = [],
  initialColor = null,
  confirmText = '确定',
  onSubmit,
  onCancel,
}: InputDialogProps): JSX.Element {
  const [value, setValue] = useState(initialValue);
  const [color, setColor] = useState<string | null>(initialColor);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setColor(initialColor);
    }
  }, [open, initialValue, initialColor]);

  const submit = (): void => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed, color);
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => !next && onCancel()} title={title}>
      <Field label={label}>
        <TextInput
          autoFocus
          className="input-lg"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
      </Field>

      {withColor && (
        <div style={{ marginTop: 12 }}>
          <label className="field-label">颜色</label>
          <ColorSwatches colors={colors} value={color} onChange={setColor} />
        </div>
      )}

      <div className="dlg-footer">
        <Button title="取消" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" title={confirmText} disabled={!value.trim()} onClick={submit}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
