import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  attachWindowListeners,
  beginPress,
  cancel,
  dispose,
  end,
  move,
} from "../../library/interactions/library-drag-session";
import { autoScrollTimelineNearEdge } from "../../timeline/drop-host";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

const DROP_ZONE_SELECTOR = '[data-timeline-drop-zone="true"]';

function isOverTimelineDropZone(clientX: number, clientY: number): boolean {
  return Boolean(
    document.elementFromPoint(clientX, clientY)?.closest(DROP_ZONE_SELECTOR),
  );
}

/**
 * Pointer gesture for library tiles.
 * Drag past threshold then drop on timeline → commit with placement.
 * Plain click (no drag) → single commit (default track).
 * Never fires both.
 */
export function useLibraryPointerGesture(
  payload: LibraryPayload,
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void,
): {
  onPointerDown: (event: ReactPointerEvent) => void;
} {
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      disposeRef.current?.();
      disposeRef.current = null;
      cancel();
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();

    disposeRef.current?.();
    beginPress(payloadRef.current, event.clientX, event.clientY);

    const onMove = (ev: PointerEvent) => {
      move(ev.clientX, ev.clientY);
      autoScrollTimelineNearEdge(ev.clientX, ev.clientY);
    };

    const tearDown = () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };

    const onUp = (ev: PointerEvent) => {
      tearDown();
      const result = end(
        ev.clientX,
        ev.clientY,
        isOverTimelineDropZone(ev.clientX, ev.clientY),
      );
      if (result.kind === "commit") {
        onCommitRef.current(result.item, {
          clientX: result.clientX,
          clientY: result.clientY,
          mode: result.mode,
        });
      }
    };

    const onCancel = () => {
      tearDown();
      cancel();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      tearDown();
      cancel();
    };

    disposeRef.current = attachWindowListeners({
      onMove,
      onUp,
      onCancel,
      onKeyDown,
    });
  };

  return { onPointerDown };
}

/** Explicit dispose helper for callers that manage their own teardown. */
export function disposeLibraryPointerGesture(): void {
  dispose();
  cancel();
}
