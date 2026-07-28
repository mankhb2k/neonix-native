/** Imperative drag preview — cyan cursor + gray ghost share one rAF so they move in sync. */

let previewEl: HTMLElement | null = null;
let ghostEl: HTMLElement | null = null;
let ghostLeftOffset = 0;

let rafId = 0;
let pendingCursor: { x: number; y: number } | null = null;
let pendingGhost: { left: number; width: number } | null = null;

function applyCursorTransform(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}

function applyGhostLayout(
  el: HTMLElement,
  left: number,
  width: number,
  leftOffset: number,
): void {
  el.style.left = `${left + leftOffset}px`;
  el.style.width = `${width}px`;
}

function flush(): void {
  rafId = 0;
  if (previewEl && pendingCursor) {
    applyCursorTransform(previewEl, pendingCursor.x, pendingCursor.y);
  }
  if (ghostEl && pendingGhost) {
    applyGhostLayout(
      ghostEl,
      pendingGhost.left,
      pendingGhost.width,
      ghostLeftOffset,
    );
  }
}

function scheduleFlush(): void {
  if (rafId) return;
  rafId = requestAnimationFrame(flush);
}

export function bindDragPreviewElement(el: HTMLElement | null): void {
  previewEl = el;
  if (el && pendingCursor) {
    applyCursorTransform(el, pendingCursor.x, pendingCursor.y);
  }
}

export function bindDragGhostElement(
  el: HTMLElement | null,
  options?: { leftOffset?: number },
): void {
  ghostEl = el;
  ghostLeftOffset = options?.leftOffset ?? 0;
  if (el && pendingGhost) {
    applyGhostLayout(el, pendingGhost.left, pendingGhost.width, ghostLeftOffset);
  }
}

/** Only clears binding if `el` is still the active ghost (avoids child/parent effect races). */
export function unbindDragGhostElementIf(el: HTMLElement | null): void {
  if (el && ghostEl === el) {
    ghostEl = null;
    ghostLeftOffset = 0;
  }
}

export function setDragCursor(x: number, y: number): void {
  pendingCursor = { x, y };
  scheduleFlush();
}

export function setDragGhostLayout(left: number, width: number): void {
  pendingGhost = { left, width };
  scheduleFlush();
}

export function clearDragCursor(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  pendingCursor = null;
  pendingGhost = null;
}
