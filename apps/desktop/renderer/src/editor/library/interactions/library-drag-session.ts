/**
 * Pointer drag session for library → timeline.
 * State machine: idle → pressed → dragging → committed|cancelled (via idle).
 * Owner token prevents foreign unmount from cancelling another gesture.
 */

import type { LibraryPayload } from "../model/library-payload";

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

export function getSession(): LibraryDragSessionState {
  return current;
}

/** @deprecated Prefer getSession() */
export function getLibraryDragSession(): LibraryDragSessionState {
  return getSession();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** @deprecated Prefer subscribe() */
export function subscribeLibraryDrag(listener: Listener): () => void {
  return subscribe(listener);
}

export function attachWindowListeners(
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

export function dispose(): void {
  disposeAttached?.();
  disposeAttached = null;
}

export function beginPress(
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

export function move(x: number, y: number): void {
  if (current.phase !== "pressed" && current.phase !== "dragging") return;

  if (current.phase === "pressed") {
    const dx = x - current.originX;
    const dy = y - current.originY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      return;
    }
    setState({
      ...current,
      phase: "dragging",
      clientX: x,
      clientY: y,
    });
    return;
  }

  setState({
    ...current,
    clientX: x,
    clientY: y,
  });
}

export function end(
  clientX: number,
  clientY: number,
  isOverTimelineDropZone: boolean,
): LibraryDragEndResult {
  const { phase, item } = current;
  dispose();

  if (!item || phase === "idle" || phase === "committed" || phase === "cancelled") {
    setState(IDLE);
    return { kind: "cancel" };
  }

  if (phase === "pressed") {
    setState({ ...IDLE, phase: "committed" });
    setState(IDLE);
    return {
      kind: "commit",
      item,
      clientX,
      clientY,
      mode: "click",
    };
  }

  if (phase === "dragging" && isOverTimelineDropZone) {
    setState({
      phase: "committed",
      item,
      clientX,
      clientY,
      originX: current.originX,
      originY: current.originY,
      ownerId: current.ownerId,
      pointerId: current.pointerId,
    });
    setState(IDLE);
    return {
      kind: "commit",
      item,
      clientX,
      clientY,
      mode: "drag",
    };
  }

  setState({
    phase: "cancelled",
    item,
    clientX,
    clientY,
    originX: current.originX,
    originY: current.originY,
    ownerId: current.ownerId,
    pointerId: current.pointerId,
  });
  setState(IDLE);
  return { kind: "cancel" };
}

/** Cancel only if owner matches (or owner omitted for Escape/global cancel). */
export function cancel(ownerId?: string): void {
  if (ownerId != null && current.ownerId != null && current.ownerId !== ownerId) {
    return;
  }
  dispose();
  if (current.phase === "idle") return;
  setState({
    ...current,
    phase: "cancelled",
  });
  setState(IDLE);
}
