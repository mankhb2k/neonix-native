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
  collectSceneLanes,
  collectAudioZoneLanes,
  cacheSceneLanesRelative,
  cacheAudioLanesRelative,
  absoluteSceneLanes,
  absoluteAudioLanes,
  resolveOverlayDragTarget,
  resolveAudioDragTarget,
  INDICATOR_TOP_EPS_PX,
  type RelativeLaneHit,
  type RelativeAudioLaneHit,
} from "./lane-drop-target";
import {
  shouldCommitPointerSession,
  type PointerSessionEndReason,
} from "@/lib/editor/pointer-session";
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
export function useTimelineClipMove({
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
  /** Cache lane rects lúc bắt đầu drag — invalidate khi scroll. */
  const laneCacheRef = useRef<{
    scene: RelativeLaneHit[] | null;
    audio: RelativeAudioLaneHit[] | null;
  }>({ scene: null, audio: null });

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
      return () => undefined;
    }
    bindDragGhostElement(insertGhostRef.current, {
      leftOffset: TIMELINE_LABEL_WIDTH,
    });
    return () => {
      unbindDragGhostElementIf(insertGhostRef.current);
    };
  }, [isInsertLine, dragGhostState != null]);

  // Invalidate lane rect cache khi scroll/resize workspace.
  useEffect(() => {
    const root = rootRef.current;
    const ws = workspaceRef.current;
    const invalidate = () => {
      laneCacheRef.current = { scene: null, audio: null };
    };
    root?.addEventListener("scroll", invalidate, { passive: true });
    ws?.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      root?.removeEventListener("scroll", invalidate);
      ws?.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
  }, [rootRef, workspaceRef]);

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
    laneCacheRef.current = { scene: null, audio: null };
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
      // Cache kích thước ghost một lần khi session bắt đầu — không setState mỗi move.
      const pps = Math.max(pixelsPerSecondRef.current, 1);
      setDragGhostState({
        left: 0,
        width: Math.max(session.duration * pps, 24),
        label: session.name,
        duration: session.duration,
        targetTrack: session.source === "audio" ? "audio" : "video",
      });
      // Cache lane rects relative — tránh querySelectorAll mỗi pointermove.
      const wsEl = workspaceRef.current;
      if (wsEl) {
        const wsTop0 = wsEl.getBoundingClientRect().top;
        laneCacheRef.current = {
          scene: cacheSceneLanesRelative(wsEl, wsTop0),
          audio: cacheAudioLanesRelative(wsEl, wsTop0),
        };
      }
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
    const ws = workspaceRef.current;
    if (!ws) return;

    const wsTop = ws.getBoundingClientRect().top;

    if (isAudio) {
      const cached = laneCacheRef.current.audio;
      const lanes = cached
        ? absoluteAudioLanes(cached, wsTop)
        : collectAudioZoneLanes(ws);
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

    const cached = laneCacheRef.current.scene;
    const lanes = cached
      ? absoluteSceneLanes(cached, wsTop)
      : collectSceneLanes(ws);
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

  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);

  function schedulePointerMove(clientX: number, clientY: number) {
    // PERF-02: coalesce pointermove — tối đa một flush / animation frame.
    pendingPointerRef.current = { x: clientX, y: clientY };
    if (moveRafRef.current != null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const pending = pendingPointerRef.current;
      if (!pending) return;
      applyPointerMove(pending.x, pending.y);
    });
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
            ? { insertOrder: ui.insertOrder }
            : {}),
        });
    resetMoveUi();
  }

  function endPointerSession(reason: PointerSessionEndReason, pointerId?: number) {
    const session = sessionRef.current;
    if (!session) return;
    if (pointerId != null && session.pointerId !== pointerId) return;
    // UX-02: chỉ pointerup mới commit; cancel/Escape rollback.
    if (shouldCommitPointerSession(reason)) {
      commitMove();
      return;
    }
    resetMoveUi();
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      schedulePointerMove(event.clientX, event.clientY);
    }

    function onPointerUp(event: PointerEvent) {
      // Flush RAF còn treo trước khi commit.
      if (moveRafRef.current != null) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      const pending = pendingPointerRef.current;
      if (pending) {
        applyPointerMove(pending.x, pending.y);
        pendingPointerRef.current = null;
      }
      endPointerSession("pointerup", event.pointerId);
    }

    function onPointerCancel(event: PointerEvent) {
      if (moveRafRef.current != null) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      pendingPointerRef.current = null;
      endPointerSession("pointercancel", event.pointerId);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!sessionRef.current) return;
      event.preventDefault();
      if (moveRafRef.current != null) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      pendingPointerRef.current = null;
      endPointerSession("escape");
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
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
    movingClipId,
    isOverlayInsertLine,
    isAudioInsertLine,
    targetOverlayLaneId,
    targetAudioLaneId,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    beginOverlayPointerDown,
    beginMainPointerDown,
    beginAudioPointerDown,
    isMoving: movingClipId != null,
  };
}
