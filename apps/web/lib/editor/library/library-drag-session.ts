/**
 * Pointer drag session for library → stage/timeline.
 * State machine: idle → pressed → dragging → committed|cancelled (via idle).
 */

import type { LibraryPayload } from "./library-payload";

export type LibraryDragPhase =
  | "idle"
  | "pressed"
  | "dragging"
  | "committed"
  | "cancelled";

export type LibraryDragSessionState = {
  phase: LibraryDragPhase;
  item: LibraryPayload | null;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
  ownerId: string | null;
  pointerId: number | null;
};

export type LibraryDragEndResult =
  | {
      kind: "commit";
      item: LibraryPayload;
      clientX: number;
      clientY: number;
      mode: "click" | "drag";
    }
  | { kind: "cancel" };

type Listener = (session: LibraryDragSessionState) => void;

export type WindowListenerHandlers = {
  onMove: (event: PointerEvent) => void;
  onUp: (event: PointerEvent) => void;
  onCancel: (event: PointerEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
};

const DRAG_THRESHOLD_PX = 4;

const IDLE: LibraryDragSessionState = {
  phase: "idle",
  item: null,
  clientX: 0,
  clientY: 0,
  originX: 0,
  originY: 0,
  ownerId: null,
  pointerId: null,
};

let current: LibraryDragSessionState = IDLE;
const listeners = new Set<Listener>();
let disposeAttached: (() => void) | null = null;
let ownerSeq = 0;

export function createLibraryDragOwnerId(): string {
  ownerSeq += 1;
  return `lib_drag_${ownerSeq}`;
}

function emit(): void {
  for (const listener of listeners) listener(current);
}

function emitIfNeeded(
  prev: LibraryDragSessionState,
  next: LibraryDragSessionState,
): void {
  const phaseChanged = prev.phase !== next.phase;
  const draggingMoved =
    next.phase === "dragging" &&
    (prev.clientX !== next.clientX || prev.clientY !== next.clientY);
  if (phaseChanged || draggingMoved) emit();
}

function setState(next: LibraryDragSessionState): void {
  const prev = current;
  current = next;
  emitIfNeeded(prev, next);
}

export function getLibraryDragSession(): LibraryDragSessionState {
  return current;
}

export function subscribeLibraryDrag(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function attachLibraryDragWindowListeners(
  handlers: WindowListenerHandlers,
): () => void {
  disposeAttached?.();
  const { onMove, onUp, onCancel, onKeyDown } = handlers;
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  if (onKeyDown) window.addEventListener("keydown", onKeyDown);
  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
    if (disposeAttached === cleanup) disposeAttached = null;
  };
  disposeAttached = cleanup;
  return cleanup;
}

export function disposeLibraryDragListeners(): void {
  disposeAttached?.();
  disposeAttached = null;
}

export function beginLibraryPress(
  item: LibraryPayload,
  x: number,
  y: number,
  ownerId: string,
  pointerId: number | null = null,
): void {
  setState({
    phase: "pressed",
    item,
    clientX: x,
    clientY: y,
    originX: x,
    originY: y,
    ownerId,
    pointerId,
  });
}

export function moveLibraryDrag(x: number, y: number): void {
  if (current.phase !== "pressed" && current.phase !== "dragging") return;
  if (current.phase === "pressed") {
    const dx = x - current.originX;
    const dy = y - current.originY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    setState({
      ...current,
      phase: "dragging",
      clientX: x,
      clientY: y,
    });
    return;
  }
  setState({ ...current, clientX: x, clientY: y });
}

export function endLibraryDrag(
  clientX: number,
  clientY: number,
  isOverDropZone: boolean,
): LibraryDragEndResult {
  const { phase, item } = current;
  disposeLibraryDragListeners();

  if (!item || phase === "idle" || phase === "committed" || phase === "cancelled") {
    setState(IDLE);
    return { kind: "cancel" };
  }

  if (phase === "pressed") {
    setState(IDLE);
    return { kind: "commit", item, clientX, clientY, mode: "click" };
  }

  if (phase === "dragging" && isOverDropZone) {
    setState(IDLE);
    return { kind: "commit", item, clientX, clientY, mode: "drag" };
  }

  setState(IDLE);
  return { kind: "cancel" };
}

export function cancelLibraryDrag(ownerId?: string): void {
  if (ownerId != null && current.ownerId != null && current.ownerId !== ownerId) {
    return;
  }
  disposeLibraryDragListeners();
  if (current.phase === "idle") return;
  setState(IDLE);
}
