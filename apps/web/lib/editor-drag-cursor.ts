/** Imperative drag-preview cursor — avoids Zustand/React on pointer-rate updates. */

let previewEl: HTMLElement | null = null;
let rafId = 0;
let pending: { x: number; y: number } | null = null;

function applyTransform(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}

export function bindDragPreviewElement(el: HTMLElement | null): void {
  previewEl = el;
  if (el && pending) {
    applyTransform(el, pending.x, pending.y);
  }
}

export function setDragCursor(x: number, y: number): void {
  pending = { x, y };
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (!previewEl || !pending) return;
    applyTransform(previewEl, pending.x, pending.y);
  });
}

export function clearDragCursor(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  pending = null;
}
