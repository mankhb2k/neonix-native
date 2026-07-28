"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { OverlaySceneItem } from "@/lib/overlay-scenes";
import {
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  setDragPreviewAnchor,
  unbindDragGhostElementIf,
} from "@/lib/editor-drag-cursor";
import {
  collectVideoLanes,
  resolveOverlayDragTarget,
  INDICATOR_TOP_EPS_PX,
} from "./overlay-drag-target";
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";
import type { DragGhostState } from "./useTracksDrag";

/** Cyan h-8 vertically centered; left edge on cursor (same as sidebar timeline drag). */
const CYAN_ANCHOR_X = 0;
const CYAN_ANCHOR_Y = 16;
/** Start move only after this drag distance (keeps click = select). */
const MOVE_THRESHOLD_PX = 4;

type UseOverlayClipMoveArgs = {
  rootRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  uniqueLayers: number[];
};

type MoveSession = {
  id: string;
  name: string;
  duration: number;
  pointerId: number;
  originX: number;
  originY: number;
  started: boolean;
};

/**
 * Pointer-drag an already-selected overlay clip across time + lanes
 * (reuses insert-line / gray ghost policy from sidebar drops).
 */
export function useOverlayClipMove({
  rootRef,
  workspaceRef,
  pixelsPerSecond,
  uniqueLayers,
}: UseOverlayClipMoveArgs) {
  const moveOverlayScene = useEditorStore((s) => s.moveOverlayScene);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);

  const insertGhostRef = useRef<HTMLDivElement>(null);
  const moveUiRef = useRef({
    isInsert: false,
    layer: null as number | null,
    indicatorTop: 0,
  });
  const ghostLeftRef = useRef(0);
  const sessionRef = useRef<MoveSession | null>(null);

  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const uniqueLayersRef = useRef(uniqueLayers);
  pixelsPerSecondRef.current = pixelsPerSecond;
  uniqueLayersRef.current = uniqueLayers;

  const [movingOverlayId, setMovingOverlayId] = useState<string | null>(null);
  const [isOverlayInsertLine, setIsOverlayInsertLine] = useState(false);
  const [targetOverlayLayer, setTargetOverlayLayer] = useState<number | null>(
    null,
  );
  const [indicatorTopPos, setIndicatorTopPos] = useState(0);
  const [dragGhostState, setDragGhostState] = useState<DragGhostState | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!isOverlayInsertLine || !dragGhostState) {
      unbindDragGhostElementIf(insertGhostRef.current);
      return;
    }
    bindDragGhostElement(insertGhostRef.current, {
      leftOffset: TIMELINE_LABEL_WIDTH,
    });
    return () => {
      unbindDragGhostElementIf(insertGhostRef.current);
    };
  }, [isOverlayInsertLine, dragGhostState != null]);

  function resetMoveUi() {
    moveUiRef.current = { isInsert: false, layer: null, indicatorTop: 0 };
    ghostLeftRef.current = 0;
    sessionRef.current = null;
    setMovingOverlayId(null);
    setIsOverlayInsertLine(false);
    setTargetOverlayLayer(null);
    setDragGhostState(null);
    setIsOverTimeline(false);
    setActiveDragItem(null);
    clearDragCursor();
  }

  function applyPointerMove(clientX: number, clientY: number) {
    const session = sessionRef.current;
    if (!session || !rootRef.current) return;

    if (!session.started) {
      const dx = clientX - session.originX;
      const dy = clientY - session.originY;
      if (dx * dx + dy * dy < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) return;
      session.started = true;
      setMovingOverlayId(session.id);
      setIsOverTimeline(true);
      setDragPreviewAnchor(CYAN_ANCHOR_X, CYAN_ANCHOR_Y);
      // Drive GlobalDragPreview cyan block (same path as sidebar drag).
      setActiveDragItem({
        id: session.id,
        type: "frame",
        name: session.name,
        duration: session.duration,
      });
    }

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const rect = rootRef.current.getBoundingClientRect();
    const scrollLeft = rootRef.current.scrollLeft;
    const mouseX =
      clientX - rect.left + scrollLeft - TIMELINE_LABEL_WIDTH;
    const left = Math.max(0, mouseX);
    ghostLeftRef.current = left;

    const ghostWidth = Math.max(session.duration * pps, 24);
    setDragGhostLayout(left, ghostWidth);
    if (clientX > 0 && clientY > 0) {
      setDragCursor(clientX, clientY);
    }

    setDragGhostState({
      left,
      width: ghostWidth,
      label: session.name,
      duration: session.duration,
      targetTrack: "video",
    });

    const ws = workspaceRef.current;
    if (!ws) return;

    const wsTop = ws.getBoundingClientRect().top;
    const lanes = collectVideoLanes(ws);
    const layers = uniqueLayersRef.current;
    const maxOverlayLayer = layers.length > 0 ? Math.max(...layers) : 0;
    const target = resolveOverlayDragTarget(
      clientY,
      lanes,
      wsTop,
      moveUiRef.current.isInsert,
      maxOverlayLayer,
    );
    if (!target) return;

    const ui = moveUiRef.current;
    const layerChanged = ui.layer !== target.layer;
    const insertChanged = ui.isInsert !== target.isInsert;
    const topChanged =
      target.isInsert &&
      Math.abs(ui.indicatorTop - target.indicatorTop) > INDICATOR_TOP_EPS_PX;
    if (insertChanged || layerChanged || topChanged) {
      ui.isInsert = target.isInsert;
      ui.layer = target.layer;
      if (insertChanged) setIsOverlayInsertLine(target.isInsert);
      if (layerChanged) setTargetOverlayLayer(target.layer);
      if (target.isInsert && (topChanged || insertChanged)) {
        ui.indicatorTop = target.indicatorTop;
        setIndicatorTopPos(target.indicatorTop);
      }
    }
  }

  function commitMove() {
    const session = sessionRef.current;
    if (!session) {
      resetMoveUi();
      return;
    }

    if (!session.started) {
      // Pure click — selection already applied on pointerdown.
      resetMoveUi();
      return;
    }

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const startTime = ghostLeftRef.current / pps;
    const layer = moveUiRef.current.layer ?? 0;
    const insertNewLayer = moveUiRef.current.isInsert;
    moveOverlayScene(session.id, {
      startTime,
      layerIndex: layer,
      insertNewLayer,
    });
    resetMoveUi();
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      applyPointerMove(event.clientX, event.clientY);
    }

    function onPointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      commitMove();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  function beginOverlayPointerDown(
    item: OverlaySceneItem,
    event: ReactPointerEvent,
  ) {
    // Sidebar HTML5 drag wins if already active.
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    selectOverlay(item.id);

    sessionRef.current = {
      id: item.id,
      name: item.name,
      duration: item.duration,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      started: false,
    };
  }

  return {
    movingOverlayId,
    isOverlayInsertLine,
    targetOverlayLayer,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    beginOverlayPointerDown,
    isMoving: movingOverlayId != null,
  };
}
