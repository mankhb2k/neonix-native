"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PlacementTarget } from "@motionvideo/editor-core";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
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
import { autoScrollElementNearEdge } from "@/lib/editor/interaction-host/timeline-dom";
import { commandsForLibraryPayload } from "@/lib/v2-editor/library";

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
  const { document, currentTime, applyCommands, setSelectedLayerIds } = useEditorSurface();

  const commit = (item: LibraryPayload, placement?: PlacementTarget) => {
    const commands = commandsForLibraryPayload(document, item, placement);
    const layer = commands.find((command) => command.type === "add-layer");
    if (applyCommands(commands) && layer?.type === "add-layer") {
      setSelectedLayerIds([layer.layer.id]);
    }
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
          commit(result.item, placement);
          return;
        }
        // Over timeline but placement failed — do not silently append to main.
        if (isOverTimelineDropZone(ev.clientX, ev.clientY)) return;
        // Stage drop — same as click placement on main.
        commit(result.item, { track: "main", startTime: currentTime });
        return;
      }
      commit(result.item, { track: "main", startTime: currentTime });
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
    commit(payloadRef.current, { track: "main", startTime: currentTime });
  };

  return { onPointerDown, onKeyDown };
}

export function disposeLibraryPointerGesture(): void {
  disposeLibraryDragListeners();
  cancelLibraryDrag();
}
