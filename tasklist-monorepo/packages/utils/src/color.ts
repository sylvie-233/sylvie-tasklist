const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** 是否为 `#RRGGBB` 形式的十六进制颜色。 */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** 规范化为小写 `#rrggbb`；非法值返回 null。 */
export function normalizeHexColor(value: string): string | null {
  return isHexColor(value) ? value.toLowerCase() : null;
}

/**
 * 十六进制颜色转 rgba，用于软色底（如分组 chip 的 11% 透明度）。
 * 支持 `#rgb` / `#rrggbb`；非法输入回退中性灰，保证界面不崩。
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (!HEX_COLOR.test(`#${full}`)) {
    return `rgba(107, 114, 128, ${alpha})`;
  }

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
