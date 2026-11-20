import { describe, expect, it } from 'vitest';

import { cn } from '../src/cn';

describe('cn', () => {
  it('合并字符串、对象与数组，忽略假值', () => {
    expect(cn('base', false, undefined, null, { active: true, hidden: false }, ['extra'])).toBe(
      'base active extra',
    );
  });

  it('无有效输入时返回空串', () => {
    expect(cn()).toBe('');
    expect(cn(false, null)).toBe('');
  });
});
