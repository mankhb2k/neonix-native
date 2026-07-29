"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import type { TimelineClip } from "@/lib/editor/timeline-clips";
import {
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  setDragPreviewAnchor,
  unbindDragGhostElementIf,
} from "@/lib/editor/drag-cursor";
import {
  collectVideoLanes,
  collectAudioZoneLanes,
  resolveOverlayDragTarget,
  resolveAudioDragTarget,
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
  maxOverlayOrder: number;
  maxAudioOrder: number;
};

type MoveSession = {
  source: "main" | "overlay" | "audio";
  id: string;
  name: string;
  duration: number;
  originLaneId: string;
  pointerId: number;
  originX: number;
  originY: number;
  /** Pointer X offset inside the clip (so drop keeps grab point). */
  grabOffsetX: number;
  started: boolean;
  /** Seek playhead here on pure click (main clips). */
  clickSeekTime?: number;
};

/**
 * Pointer-drag timeline clips (main + overlay + audio free-place)
 * with shared insert-line / gray ghost policy from sidebar drops.
 */
export function useOverlayClipMove({
  rootRef,
  workspaceRef,
  pixelsPerSecond,
  maxOverlayOrder,
  maxAudioOrder,
}: UseOverlayClipMoveArgs) {
  const insertGhostRef = useRef<HTMLDivElement>(null);
  const moveUiRef = useRef({
    isInsert: false,
    laneId: null as string | null,
    insertOrder: null as number | null,
    indicatorTop: 0,
    /** True only after hit-test reports main-track body (or seeded for main drag). */
    overMainBody: false,
  });
  const ghostLeftRef = useRef(0);
  const sessionRef = useRef<MoveSession | null>(null);

  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const maxOverlayOrderRef = useRef(maxOverlayOrder);
  const maxAudioOrderRef = useRef(maxAudioOrder);
  pixelsPerSecondRef.current = pixelsPerSecond;
  maxOverlayOrderRef.current = maxOverlayOrder;
  maxAudioOrderRef.current = maxAudioOrder;

  const [movingClipId, setMovingClipId] = useState<string | null>(null);
  const [isOverlayInsertLine, setIsOverlayInsertLine] = useState(false);
  const [targetOverlayLaneId, setTargetOverlayLaneId] = useState<string | null>(
    null,
  );
  const [isAudioInsertLine, setIsAudioInsertLine] = useState(false);
  const [targetAudioLaneId, setTargetAudioLaneId] = useState<string | null>(
    null,
  );
  const [indicatorTopPos, setIndicatorTopPos] = useState(0);
  const [dragGhostState, setDragGhostState] = useState<DragGhostState | null>(
    null,
  );

  const isInsertLine = isOverlayInsertLine || isAudioInsertLine;

  useLayoutEffect(() => {
    if (!isInsertLine || !dragGhostState) {
      unbindDragGhostElementIf(insertGhostRef.current);
      return;
    }
    bindDragGhostElement(insertGhostRef.current, {
      leftOffset: TIMELINE_LABEL_WIDTH,
    });
    return () => {
      unbindDragGhostElementIf(insertGhostRef.current);
    };
  }, [isInsertLine, dragGhostState != null]);

  function resetMoveUi() {
    moveUiRef.current = {
      isInsert: false,
      laneId: null,
      insertOrder: null,
      indicatorTop: 0,
      overMainBody: false,
    };
    ghostLeftRef.current = 0;
    sessionRef.current = null;
    setMovingClipId(null);
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
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
        type: session.source === "audio" ? "audio" : "frame",
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

    const isAudio = session.source === "audio";
    setDragGhostState({
      left,
      width: ghostWidth,
      label: session.name,
      duration: session.duration,
      targetTrack: isAudio ? "audio" : "video",
    });

    const ws = workspaceRef.current;
    if (!ws) return;

    const wsTop = ws.getBoundingClientRect().top;

    if (isAudio) {
      const lanes = collectAudioZoneLanes(ws);
      const target = resolveAudioDragTarget(
        clientY,
        lanes,
        wsTop,
        moveUiRef.current.isInsert,
        maxAudioOrderRef.current,
      );
      if (!target) return;

      const ui = moveUiRef.current;
      const laneChanged = ui.laneId !== target.laneId;
      const insertChanged = ui.isInsert !== target.isInsert;
      const orderChanged = ui.insertOrder !== target.insertOrder;
      const topChanged =
        target.isInsert &&
        Math.abs(ui.indicatorTop - target.indicatorTop) > INDICATOR_TOP_EPS_PX;
      if (insertChanged || laneChanged || orderChanged || topChanged) {
        ui.isInsert = target.isInsert;
        ui.laneId = target.laneId;
        ui.insertOrder = target.insertOrder;
        ui.overMainBody = false;
        if (insertChanged) setIsAudioInsertLine(target.isInsert);
        if (laneChanged) setTargetAudioLaneId(target.laneId);
        if (target.isInsert && (topChanged || insertChanged)) {
          ui.indicatorTop = target.indicatorTop;
          setIndicatorTopPos(target.indicatorTop);
        }
      }
      return;
    }

    const lanes = collectVideoLanes(ws);
    const target = resolveOverlayDragTarget(
      clientY,
      lanes,
      wsTop,
      moveUiRef.current.isInsert,
      maxOverlayOrderRef.current,
    );
    if (!target) return;

    const ui = moveUiRef.current;
    const overMainBody = !target.isInsert && target.laneId == null;
    const laneChanged = ui.laneId !== target.laneId;
    const insertChanged = ui.isInsert !== target.isInsert;
    const orderChanged = ui.insertOrder !== target.insertOrder;
    const mainChanged = ui.overMainBody !== overMainBody;
    const topChanged =
      target.isInsert &&
      Math.abs(ui.indicatorTop - target.indicatorTop) > INDICATOR_TOP_EPS_PX;
    if (insertChanged || laneChanged || orderChanged || topChanged || mainChanged) {
      ui.isInsert = target.isInsert;
      ui.laneId = target.laneId;
      ui.insertOrder = target.insertOrder;
      ui.overMainBody = overMainBody;
      if (insertChanged) setIsOverlayInsertLine(target.isInsert);
      if (laneChanged) setTargetOverlayLaneId(target.laneId);
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
      if (session.source === "main" && session.clickSeekTime != null) {
        usePlaybackClock.getState().seek(session.clickSeekTime);
      }
      resetMoveUi();
      return;
    }

    const store = useEditorStore.getState();
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const startTime = ghostLeftRef.current / pps;
    const ui = moveUiRef.current;

    if (session.source === "audio") {
      store.moveClip(session.id, {
        track: "audio",
        startTime,
        laneId: ui.laneId ?? session.originLaneId,
        insertNewLane: ui.isInsert,
        ...(ui.isInsert && ui.insertOrder != null
          ? { insertOrder: ui.insertOrder }
          : {}),
      });
      resetMoveUi();
      return;
    }

    store.moveClip(session.id, ui.overMainBody
      ? { track: "main", startTime }
      : {
          track: "overlay",
          startTime,
          laneId: ui.laneId ?? session.originLaneId,
          insertNewLane: ui.isInsert,
          ...(ui.isInsert && ui.insertOrder != null
            ? { layerIndex: ui.insertOrder }
            : {}),
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
    item: TimelineClip,
    event: ReactPointerEvent,
  ) {
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectClip(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);

    moveUiRef.current = {
      isInsert: false,
      laneId: item.laneId,
      insertOrder: null,
      indicatorTop: 0,
      overMainBody: false,
    };
    setTargetOverlayLaneId(item.laneId);
    setTargetAudioLaneId(null);
    setIsAudioInsertLine(false);

    sessionRef.current = {
      source: "overlay",
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLaneId: item.laneId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
    };
  }

  function beginMainPointerDown(
    item: TimelineClip,
    event: ReactPointerEvent,
  ) {
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectClip(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);

    moveUiRef.current = {
      isInsert: false,
      laneId: null,
      insertOrder: null,
      indicatorTop: 0,
      overMainBody: true,
    };
    setTargetOverlayLaneId(null);
    setTargetAudioLaneId(null);
    setIsAudioInsertLine(false);

    sessionRef.current = {
      source: "main",
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLaneId: item.laneId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
      clickSeekTime: item.startTime,
    };
  }

  function beginAudioPointerDown(
    item: TimelineClip,
    event: ReactPointerEvent,
  ) {
    if (useEditorStore.getState().activeDragItem) return;

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectClip(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);

    moveUiRef.current = {
      isInsert: false,
      laneId: item.laneId,
      insertOrder: null,
      indicatorTop: 0,
      overMainBody: false,
    };
    setTargetAudioLaneId(item.laneId);
    setTargetOverlayLaneId(null);
    setIsOverlayInsertLine(false);

    sessionRef.current = {
      source: "audio",
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLaneId: item.laneId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
    };
  }

  return {
    /** @deprecated Prefer movingClipId */
    movingOverlayId: movingClipId,
    movingClipId,
    isOverlayInsertLine,
    isAudioInsertLine,
    targetOverlayLaneId,
    targetAudioLaneId,
    targetOverlayLayer: null as number | null,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    beginOverlayPointerDown,
    beginMainPointerDown,
    beginAudioPointerDown,
    isMoving: movingClipId != null,
  };
}
