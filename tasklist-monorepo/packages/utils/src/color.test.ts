import { describe, expect, it } from 'vitest';

import { hexToRgba, isHexColor, normalizeHexColor } from './color';

describe('颜色校验', () => {
  it('仅接受 #RRGGBB', () => {
    expect(isHexColor('#A1B2C3')).toBe(true);
    expect(isHexColor('#abc')).toBe(false);
    expect(isHexColor('rgb(0, 0, 0)')).toBe(false);
  });

  it('规范化输出小写，非法值返回 null', () => {
    expect(normalizeHexColor('#A1B2C3')).toBe('#a1b2c3');
    expect(normalizeHexColor('red')).toBeNull();
  });
});

describe('hexToRgba', () => {
  it('转换 6 位与 3 位色值', () => {
    expect(hexToRgba('#2563eb', 0.11)).toBe('rgba(37, 99, 235, 0.11)');
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('非法色值回退中性灰', () => {
    expect(hexToRgba('red', 0.2)).toBe('rgba(107, 114, 128, 0.2)');
  });
});
