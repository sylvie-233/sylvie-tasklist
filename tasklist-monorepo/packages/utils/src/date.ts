import { differenceInCalendarDays, format, isBefore, isValid, parseISO } from 'date-fns';

/** 截止时间的人类可读描述。 */
export interface DueDescription {
  /** 展示文本，如「11/21 18:00」「今天截止」「已逾期 2 天」。 */
  text: string;
  /** 是否已逾期。 */
  overdue: boolean;
  /** 是否包含具体时刻（历史纯日期数据不含）。 */
  hasTime: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `M/D HH:mm`。 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'M/d HH:mm') : '';
}

/** `M/D`。 */
export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'M/d') : '';
}

/** `YYYY-MM-DD HH:mm`，用于展示完整截止时间。 */
export function formatDueFull(dueAt: string): string {
  const date = parseISO(dueAt);
  return isValid(date) ? `截止时间：${format(date, 'yyyy-MM-dd HH:mm')}` : '截止时间';
}

/** 规范化用户输入的截止时间：纯日期补 `T09:00`，非法输入返回空串。 */
export function normalizeDueInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const candidate = ISO_DATE.test(trimmed) ? `${trimmed}T09:00` : trimmed;
  return isValid(parseISO(candidate)) ? candidate : '';
}

/**
 * 解析截止时间展示：
 * - 带时刻（`YYYY-MM-DDTHH:mm`）：按具体时刻判断逾期，展示 `M/d HH:mm`；
 * - 纯日期：按天判断，展示「今天截止 / 明天截止 / 已逾期 N 天」。
 */
export function describeDue(dueAt: string, now: number = Date.now()): DueDescription | null {
  if (!dueAt) {
    return null;
  }
  const due = parseISO(dueAt);
  if (!isValid(due)) {
    return null;
  }
  const reference = new Date(now);
  const hasTime = dueAt.includes('T');

  if (hasTime) {
    return {
      text: format(due, 'M/d HH:mm'),
      overdue: isBefore(due, reference),
      hasTime,
    };
  }

  const diffDays = differenceInCalendarDays(due, reference);
  if (diffDays < 0) {
    return { text: `已逾期 ${-diffDays} 天`, overdue: true, hasTime };
  }
  if (diffDays === 0) {
    return { text: '今天截止', overdue: false, hasTime };
  }
  if (diffDays === 1) {
    return { text: '明天截止', overdue: false, hasTime };
  }
  return { text: format(due, 'M/d'), overdue: false, hasTime };
}
