import type { JSX } from 'react';

import { cn } from '@sylvie/utils';

export interface SwatchOption {
  value: string;
  label: string;
}

export interface ColorSwatchesProps {
  colors: ReadonlyArray<SwatchOption>;
  value: string | null;
  onChange: (color: string | null) => void;
  defaultLabel?: string;
}

/** 颜色色板：首项为「默认颜色」（不设色值）。 */
export function ColorSwatches({
  colors,
  value,
  onChange,
  defaultLabel = '默认颜色',
}: ColorSwatchesProps): JSX.Element {
  return (
    <div className="swatches">
      <button
        type="button"
        className="swatch swatch--default"
        aria-pressed={value === null}
        aria-label={defaultLabel}
        title={defaultLabel}
        onClick={() => onChange(null)}
      />
      {colors.map((color) => (
        <button
          key={color.value}
          type="button"
          className={cn('swatch')}
          style={{ background: color.value }}
          aria-pressed={value === color.value}
          aria-label={color.label}
          title={color.label}
          onClick={() => onChange(color.value)}
        />
      ))}
    </div>
  );
}
