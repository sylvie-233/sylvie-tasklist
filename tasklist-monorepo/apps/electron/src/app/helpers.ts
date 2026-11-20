/** 十六进制颜色转 rgba，用于分组 chip 的软色底。 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(107, 114, 128, ${alpha})`;
  }
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
