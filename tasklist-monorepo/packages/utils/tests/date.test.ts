import { describe, expect, it } from 'vitest';

import {
  describeDue,
  formatDate,
  formatDateTime,
  formatDueFull,
  normalizeDueInput,
} from '../src/date';

const NOW = new Date(2026, 10, 20, 10, 0, 0).getTime();

describe('格式化', () => {
  it('时间戳输出 M/D HH:mm 与 M/D', () => {
    expect(formatDateTime(NOW)).toBe('11/20 10:00');
    expect(formatDate(NOW)).toBe('11/20');
    expect(formatDateTime(null)).toBe('');
  });

  it('完整截止时间带中文前缀', () => {
    expect(formatDueFull('2026-11-21T18:00')).toBe('截止时间：2026-11-21 18:00');
    expect(formatDueFull('not-a-date')).toBe('截止时间');
  });
});

describe('normalizeDueInput', () => {
  it('纯日期补默认时刻', () => {
    expect(normalizeDueInput('2026-11-21')).toBe('2026-11-21T09:00');
  });

  it('保留合法日期时间并清空空值', () => {
    expect(normalizeDueInput('2026-11-21T18:30')).toBe('2026-11-21T18:30');
    expect(normalizeDueInput('   ')).toBe('');
  });

  it('非法输入返回空串', () => {
    expect(normalizeDueInput('2026/11/21')).toBe('');
    expect(normalizeDueInput('明天')).toBe('');
  });
});

describe('describeDue', () => {
  it('带时刻的任务按具体时刻判断逾期', () => {
    expect(describeDue('2026-11-20T09:00', NOW)).toEqual({
      text: '11/20 09:00',
      overdue: true,
      hasTime: true,
    });
    expect(describeDue('2026-11-20T18:00', NOW)).toEqual({
      text: '11/20 18:00',
      overdue: false,
      hasTime: true,
    });
  });

  it('纯日期按天给出相对描述', () => {
    expect(describeDue('2026-11-20', NOW)?.text).toBe('今天截止');
    expect(describeDue('2026-11-21', NOW)?.text).toBe('明天截止');
    expect(describeDue('2026-11-18', NOW)).toMatchObject({
      text: '已逾期 2 天',
      overdue: true,
    });
    expect(describeDue('2026-11-25', NOW)).toMatchObject({ text: '11/25', overdue: false });
  });

  it('空值与非法值返回 null', () => {
    expect(describeDue('', NOW)).toBeNull();
    expect(describeDue('not-a-date', NOW)).toBeNull();
  });
});
