import type { JSX } from 'react';

import * as SwitchPrimitive from '@radix-ui/react-switch';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title?: string;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
}

/** 滑动开关：基于 Radix Switch，自带键盘与无障碍语义。 */
export function Switch({
  checked,
  onCheckedChange,
  title,
  onLabel = '已开启',
  offLabel = '已关闭',
  disabled = false,
}: SwitchProps): JSX.Element {
  return (
    <div className="switch-field" title={title}>
      <SwitchPrimitive.Root
        className="switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title ?? '开关'}
      >
        <SwitchPrimitive.Thumb className="switch-thumb" />
      </SwitchPrimitive.Root>
      <span className="switch-state">{checked ? onLabel : offLabel}</span>
    </div>
  );
}
