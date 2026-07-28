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
  source: "main" | "overlay";
  id: string;
  name: string;
  duration: number;
  /** Layer at pointerdown (overlay) — used if hit-test never updates. */
  originLayer: number;
  pointerId: number;
  originX: number;
  originY: number;
  /** Pointer X offset inside the clip (so drop keeps grab point). */
  grabOffsetX: number;
  started: boolean;
  /** Seek playhead here on pure click (main clips). */
  clickSeekTime?: number;
};

type MainClipPointerItem = {
  id: string;
  name: string;
  duration: number;
  startTime: number;
};

/**
 * Pointer-drag timeline clips (main magnetic + overlay free-place)
 * with shared insert-line / gray ghost policy from sidebar drops.
 */
export function useOverlayClipMove({
  rootRef,
  workspaceRef,
  pixelsPerSecond,
  uniqueLayers,
}: UseOverlayClipMoveArgs) {
  const insertGhostRef = useRef<HTMLDivElement>(null);
  const moveUiRef = useRef({
    isInsert: false,
    layer: null as number | null,
    indicatorTop: 0,
    /** True only after hit-test reports main-track body (or seeded for main drag). */
    overMainBody: false,
  });
  const ghostLeftRef = useRef(0);
  const sessionRef = useRef<MoveSession | null>(null);

  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const uniqueLayersRef = useRef(uniqueLayers);
  pixelsPerSecondRef.current = pixelsPerSecond;
  uniqueLayersRef.current = uniqueLayers;

  const [movingClipId, setMovingClipId] = useState<string | null>(null);
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
    moveUiRef.current = {
      isInsert: false,
      layer: null,
      indicatorTop: 0,
      overMainBody: false,
    };
    ghostLeftRef.current = 0;
    sessionRef.current = null;
    setMovingClipId(null);
    setIsOverlayInsertLine(false);
    setTargetOverlayLayer(null);
    setDragGhostState(null);
    useEditorStore.getState().setIsOverTimeline(false);
    useEditorStore.getState().setActiveDragItem(null);
    clearDragCursor();
  }

  function clientXToGhostLeft(clientX: number, grabOffsetX: number): number {
    const root = rootRef.current;
    if (!root) return 0;
    const rect = root.getBoundingClientRect();
    const mouseX =
      clientX - rect.left + root.scrollLeft - TIMELINE_LABEL_WIDTH;
    return Math.max(0, mouseX - grabOffsetX);
  }

  function applyPointerMove(clientX: number, clientY: number) {
    const session = sessionRef.current;
    if (!session || !rootRef.current) return;

    if (!session.started) {
      const dx = clientX - session.originX;
      const dy = clientY - session.originY;
      if (dx * dx + dy * dy < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) return;
      session.started = true;
      setMovingClipId(session.id);
      useEditorStore.getState().setIsOverTimeline(true);
      setDragPreviewAnchor(CYAN_ANCHOR_X, CYAN_ANCHOR_Y);
      useEditorStore.getState().setActiveDragItem({
        id: session.id,
        type: "frame",
        name: session.name,
        duration: session.duration,
      });
    }

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const left = clientXToGhostLeft(clientX, session.grabOffsetX);
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
    const overMainBody = !target.isInsert && target.layer == null;
    const layerChanged = ui.layer !== target.layer;
    const insertChanged = ui.isInsert !== target.isInsert;
    const mainChanged = ui.overMainBody !== overMainBody;
    const topChanged =
      target.isInsert &&
      Math.abs(ui.indicatorTop - target.indicatorTop) > INDICATOR_TOP_EPS_PX;
    if (insertChanged || layerChanged || topChanged || mainChanged) {
      ui.isInsert = target.isInsert;
      ui.layer = target.layer;
      ui.overMainBody = overMainBody;
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

    const store = useEditorStore.getState();

    if (!session.started) {
      if (session.source === "main" && session.clickSeekTime != null) {
        store.setCurrentTime(session.clickSeekTime);
      }
      resetMoveUi();
      return;
    }

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const startTime = ghostLeftRef.current / pps;
    const ui = moveUiRef.current;

    if (session.source === "overlay") {
      store.moveOverlayScene(session.id, {
        startTime,
        layerIndex: ui.layer ?? session.originLayer,
        insertNewLayer: ui.isInsert,
      });
    } else if (ui.overMainBody) {
      store.reorderMainScene(session.id, startTime);
    } else {
      store.promoteMainSceneToOverlay(
        session.id,
        startTime,
        ui.layer ?? 0,
        ui.isInsert,
      );
    }
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
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectOverlay(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);

    moveUiRef.current = {
      isInsert: false,
      layer: item.layerIndex,
      indicatorTop: 0,
      overMainBody: false,
    };
    setTargetOverlayLayer(item.layerIndex);

    sessionRef.current = {
      source: "overlay",
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLayer: item.layerIndex,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
    };
  }

  function beginMainPointerDown(
    item: MainClipPointerItem,
    event: ReactPointerEvent,
  ) {
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectScene(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);

    moveUiRef.current = {
      isInsert: false,
      layer: null,
      indicatorTop: 0,
      overMainBody: true,
    };
    setTargetOverlayLayer(null);

    sessionRef.current = {
      source: "main",
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLayer: 0,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
      clickSeekTime: item.startTime,
    };
  }

  return {
    /** @deprecated Prefer movingClipId */
    movingOverlayId: movingClipId,
    movingClipId,
    isOverlayInsertLine,
    targetOverlayLayer,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    beginOverlayPointerDown,
    beginMainPointerDown,
    isMoving: movingClipId != null,
  };
}
