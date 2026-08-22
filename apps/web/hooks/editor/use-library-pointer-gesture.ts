"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PlacementTarget } from "@motionvideo/editor-core";
import {
  attachLibraryDragWindowListeners,
  beginLibraryPress,
  cancelLibraryDrag,
  createLibraryDragOwnerId,
  disposeLibraryDragListeners,
  endLibraryDrag,
  getLibraryDragSession,
  moveLibraryDrag,
} from "@/lib/editor/library/library-drag-session";
import type { LibraryPayload } from "@/lib/editor/library/library-payload";
import {
  getTimelineLibraryDropHost,
  isOverLibraryDropZone,
  isOverTimelineDropZone,
  resolveLibraryDropPlacement,
} from "@/lib/editor/library/timeline-library-drop";
import {
  libraryPayloadToDraft,
  type LibraryCommitPoint,
} from "@/lib/editor/library/commit-library-payload";
import { useEditorStore } from "@/lib/editor/editor-store";
import { autoScrollElementNearEdge } from "@/lib/editor/interaction-host/timeline-dom";

/**
 * Pointer gesture for library tiles (Text / Shape).
 * Drag past threshold → floating bubble; drop on stage/timeline → commit.
 * Click / Enter / Space → add on main track.
 */
export function useLibraryPointerGesture(payload: LibraryPayload): {
  onPointerDown: (event: ReactPointerEvent) => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
} {
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const disposeRef = useRef<(() => void) | null>(null);
  const ownerIdRef = useRef(createLibraryDragOwnerId());
  const addClipFromDraft = useEditorStore((s) => s.addClipFromDraft);

  const commit = (item: LibraryPayload, point: LibraryCommitPoint) => {
    const draft = libraryPayloadToDraft(item);
    if (point.mode === "drag") {
      addClipFromDraft(draft, {
        track: point.placement.track,
        laneId: point.placement.laneId,
        startTime: point.placement.startTime,
        insertNewLane: point.placement.insertNewLane,
        insertOrder: point.placement.insertOrder,
      });
      return;
    }
    addClipFromDraft(draft, { track: "main" });
  };

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    return () => {
      disposeRef.current?.();
      disposeRef.current = null;
      cancelLibraryDrag(ownerId);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    disposeRef.current?.();
    beginLibraryPress(
      payloadRef.current,
      event.clientX,
      event.clientY,
      ownerIdRef.current,
      event.pointerId,
    );
    const activePointerId = event.pointerId;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId) return;
      moveLibraryDrag(ev.clientX, ev.clientY);
      if (getLibraryDragSession().phase !== "dragging") return;
      const scroll = getTimelineLibraryDropHost()?.scrollEl;
      if (scroll) {
        autoScrollElementNearEdge(scroll, ev.clientX, ev.clientY, 40, 14);
      }
    };

    const tearDown = () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId) return;
      const session = getLibraryDragSession();
      const phase = session.phase;
      let allowDrop = isOverLibraryDropZone(ev.clientX, ev.clientY);
      let placement: PlacementTarget | undefined;

      if (phase === "dragging" && isOverTimelineDropZone(ev.clientX, ev.clientY)) {
        placement =
          session.item != null
            ? resolveLibraryDropPlacement(ev.clientX, ev.clientY, session.item) ??
              undefined
            : undefined;
        allowDrop = Boolean(placement) || isOverLibraryDropZone(ev.clientX, ev.clientY);
      }

      tearDown();
      const result = endLibraryDrag(ev.clientX, ev.clientY, allowDrop);
      if (result.kind !== "commit") return;

      if (result.mode === "drag") {
        if (placement) {
          commit(result.item, { mode: "drag", placement });
          return;
        }
        // Over timeline but placement failed — do not silently append to main.
        if (isOverTimelineDropZone(ev.clientX, ev.clientY)) return;
        // Stage drop — same as click placement on main.
        commit(result.item, { mode: "click" });
        return;
      }
      commit(result.item, { mode: "click" });
    };

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId) return;
      tearDown();
      cancelLibraryDrag(ownerIdRef.current);
    };

    const onKeyDownWin = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      tearDown();
      cancelLibraryDrag(ownerIdRef.current);
    };

    disposeRef.current = attachLibraryDragWindowListeners({
      onMove,
      onUp,
      onCancel,
      onKeyDown: onKeyDownWin,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    commit(payloadRef.current, { mode: "click" });
  };

  return { onPointerDown, onKeyDown };
}

export function disposeLibraryPointerGesture(): void {
  disposeLibraryDragListeners();
  cancelLibraryDrag();
}
