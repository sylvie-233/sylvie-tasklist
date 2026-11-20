/**
 * 拖拽结束后的点击抑制。
 *
 * dnd-kit 在 pointerup 之后浏览器仍会派发 click，若直接打开任务详情会误触。
 * 用一个时间戳窗口把紧随拖拽的 click 忽略掉。
 */
let lastDragEndAt = 0;

export function markDragEnd(): void {
  lastDragEndAt = Date.now();
}

export function shouldIgnoreClick(): boolean {
  return Date.now() - lastDragEndAt < 200;
}
