import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  attachWindowListeners,
  beginPress,
  cancel,
  createLibraryDragOwnerId,
  dispose,
  end,
  getSession,
  move,
} from "../interactions/library-drag-session";
import { autoScrollTimelineNearEdge } from "../../timeline/drop/auto-scroll";
import { resolveLibraryPlacement } from "../../timeline/drop/library-drop";
import type { LibraryCommitPoint } from "../adapters/commit-library-payload";
import type { LibraryPayload } from "../model/library-payload";

const DROP_ZONE_SELECTOR = '[data-timeline-drop-zone="true"]';

function isOverTimelineDropZone(clientX: number, clientY: number): boolean {
  return Boolean(
    document.elementFromPoint(clientX, clientY)?.closest(DROP_ZONE_SELECTOR),
  );
}

/**
 * Pointer gesture for library tiles.
 * Drag past threshold then drop on compatible timeline lane → commit.
 * Plain click / Enter / Space → single commit (default track).
 */
export function useLibraryPointerGesture(
  payload: LibraryPayload,
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void,
): {
  onPointerDown: (event: ReactPointerEvent) => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
} {
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const disposeRef = useRef<(() => void) | null>(null);
  const ownerIdRef = useRef(createLibraryDragOwnerId());

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    return () => {
      disposeRef.current?.();
      disposeRef.current = null;
      cancel(ownerId);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();

    disposeRef.current?.();
    beginPress(
      payloadRef.current,
      event.clientX,
      event.clientY,
      ownerIdRef.current,
      event.pointerId,
    );

    const onMove = (ev: PointerEvent) => {
      move(ev.clientX, ev.clientY);
      if (getSession().phase === "dragging") {
        autoScrollTimelineNearEdge(ev.clientX, ev.clientY);
      }
    };

    const tearDown = () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };

    const onUp = (ev: PointerEvent) => {
      const phase = getSession().phase;
      let allowDrop = isOverTimelineDropZone(ev.clientX, ev.clientY);
      let placement: LibraryCommitPoint["placement"];
      if (phase === "dragging") {
        // Resolve once here; commit reuses the same PlacementTarget (hysteresis).
        placement = resolveLibraryPlacement(
          ev.clientX,
          ev.clientY,
          payloadRef.current,
        );
        allowDrop = Boolean(placement);
      }
      tearDown();
      const result = end(ev.clientX, ev.clientY, allowDrop);
      if (result.kind === "commit") {
        onCommitRef.current(result.item, {
          mode: result.mode,
          ...(result.mode === "drag" ? { placement } : {}),
        });
      }
    };

    const onCancel = () => {
      tearDown();
      cancel(ownerIdRef.current);
    };

    const onKeyDownWin = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      tearDown();
      cancel(ownerIdRef.current);
    };

    disposeRef.current = attachWindowListeners({
      onMove,
      onUp,
      onCancel,
      onKeyDown: onKeyDownWin,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onCommitRef.current(payloadRef.current, {
      mode: "click",
    });
  };

  return { onPointerDown, onKeyDown };
}

export function disposeLibraryPointerGesture(): void {
  dispose();
  cancel();
}
