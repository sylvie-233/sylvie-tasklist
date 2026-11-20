/**
 * 拖拽结束后的点击抑制（与框架无关的模块级时间窗）。
 *
 * dnd-kit 等库在 pointerup 之后浏览器仍会派发 click，若卡片点击会打开详情，
 * 就会在拖拽结束时误触。用时间戳窗口把紧随拖拽的 click 忽略掉。
 */
const CLICK_SUPPRESS_MS = 200;

let lastDragEndAt = 0;

export function markDragEnd(): void {
  lastDragEndAt = Date.now();
}

export function shouldIgnoreClick(): boolean {
  return Date.now() - lastDragEndAt < CLICK_SUPPRESS_MS;
}
