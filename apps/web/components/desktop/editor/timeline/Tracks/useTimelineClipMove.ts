"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  acquireDragCursor,
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  setDragPreviewAnchor,
  unbindDragGhostElementIf,
} from "@/lib/editor/drag-cursor";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import {
  buildClipMovePatch,
  createClipMoveSessionState,
  updateClipMoveSessionState,
  type MoveSessionState,
} from "@/lib/editor/timeline/sessions/clip-move-session";
import {
  bindLaneCacheInvalidation,
  createEmptyLaneRectCache,
  invalidateLaneRectCache,
  resolveAudioDropAtPointer,
  resolveVisualDropAtPointer,
  type LaneRectCache,
} from "./lane-drop-session";
import {
  INDICATOR_TOP_EPS_PX,
  type TimelineDropTarget,
} from "./lane-drop-target";
import { DomGeometryAdapter } from "../interactions/dom-geometry-adapter";
import { usePointerSession } from "../interactions/use-pointer-session";
import type { TimelineAutoScrollController } from "./useTimelineAutoScroll";
import type { DragGhostState } from "./useTracksDrag";
import type { TimelineClip } from "@/lib/editor/timeline-clips";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";

/** Cyan h-8 vertically centered; left edge on cursor (same as sidebar timeline drag). */
const CYAN_ANCHOR_X = 0;
const CYAN_ANCHOR_Y = 16;
/** Start move only after this drag distance (keeps click = select). */
const MOVE_THRESHOLD_PX = 4;

/** scrollContainerRef = timeline scroll root (historically rootRef). */
type UseTimelineClipMoveArgs = {
  rootRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  maxOverlayOrder: number;
  maxAudioOrder: number;
  autoScroll: TimelineAutoScrollController;
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
  cursorToken: string | null;
  domain: MoveSessionState;
  /** Seek playhead here on pure click (main clips). */
  clickSeekTime?: number;
};

/**
 * Pointer-drag timeline clips (main + overlay + audio free-place)
 * with shared insert-line / gray ghost policy from sidebar drops.
 */
export function useTimelineClipMove({
  rootRef: scrollContainerRef,
  workspaceRef,
  pixelsPerSecond,
  maxOverlayOrder,
  maxAudioOrder,
  autoScroll,
}: UseTimelineClipMoveArgs) {
  const insertGhostRef = useRef<HTMLDivElement>(null);
  const dropTargetRef = useRef<{
    isInsert: boolean;
    laneId: string | null;
    insertOrder: number | null;
    indicatorTop: number;
    /** True only after hit-test reports base body (or seeded for main drag). */
    overBaseBody: boolean;
  }>({
    isInsert: false,
    laneId: null,
    insertOrder: null,
    indicatorTop: 0,
    overBaseBody: false,
  });
  const ghostLeftRef = useRef(0);
  const sessionRef = useRef<MoveSession | null>(null);
  const laneCacheRef = useRef<LaneRectCache>(createEmptyLaneRectCache());
  if (!laneCacheRef.current.adapter) {
    laneCacheRef.current.adapter = new DomGeometryAdapter({
      pixelsPerSecond,
    });
  }
  laneCacheRef.current.adapter.setPixelsPerSecond(pixelsPerSecond);

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
  /** Family that owns the insertion line. Prevents stale audio UI appearing
   * during a visual clip drag and the reverse. */
  const [insertTargetFamily, setInsertTargetFamily] = useState<
    "visual" | "audio" | null
  >(null);
  const [dragGhostState, setDragGhostState] = useState<DragGhostState | null>(
    null,
  );

  const dragFamily =
    dragGhostState?.targetTrack === "audio" ? "audio" : "visual";
  const isInsertLine =
    (isOverlayInsertLine || isAudioInsertLine) &&
    insertTargetFamily === dragFamily;
  const hasDragGhost = dragGhostState != null;

  const applyPointerMoveRef = useRef<(x: number, y: number) => void>(
    () => undefined,
  );
  const commitMoveRef = useRef<() => void>(() => undefined);
  const resetMoveUiRef = useRef<() => void>(() => undefined);

  const pointerSession = usePointerSession({
    name: "clip-move",
    onStart: () => ({}),
    onUpdate: (pos) => {
      applyPointerMoveRef.current(pos.x, pos.y);
      return {};
    },
    onCommit: () => {
      commitMoveRef.current();
    },
    onCancel: () => {
      resetMoveUiRef.current();
    },
  });
  const pointerSessionRef = useRef(pointerSession);
  pointerSessionRef.current = pointerSession;

  useLayoutEffect(() => {
    const ghostEl = insertGhostRef.current;
    if (!isInsertLine || !hasDragGhost) {
      unbindDragGhostElementIf(ghostEl);
      return undefined;
    }
    bindDragGhostElement(ghostEl, {
      // Ghost lives inside Tracks canvas (labels/gutter are sibling columns).
      leftOffset: 0,
    });
    return () => {
      unbindDragGhostElementIf(ghostEl);
    };
  }, [isInsertLine, hasDragGhost]);

  // Invalidate lane rect cache khi scroll/resize — pointermove sau sẽ recache.
  useEffect(
    () =>
      bindLaneCacheInvalidation(
        scrollContainerRef,
        workspaceRef,
        laneCacheRef.current,
        () => {
          const session = sessionRef.current;
          if (session?.started) {
            const token = pointerSessionRef.current.token();
            if (token) {
              /* keep moving via next pointer update */
            }
          }
        },
      ),
    [scrollContainerRef, workspaceRef],
  );

  /** Clear store/global drag chrome without touching React local setters (safe on unmount). */
  function cleanupExternalDragState() {
    const token = sessionRef.current?.cursorToken ?? undefined;
    sessionRef.current = null;
    useEditorStore.getState().setIsOverTimeline(false);
    useEditorStore.getState().setActiveDragItem(null);
    clearDragCursor(token);
    unbindDragGhostElementIf(insertGhostRef.current);
  }

  function resetMoveUi() {
    const token = sessionRef.current?.cursorToken ?? undefined;
    autoScroll.stop("clip-move", token);
    dropTargetRef.current = {
      isInsert: false,
      laneId: null,
      insertOrder: null,
      indicatorTop: 0,
      overBaseBody: false,
    };
    ghostLeftRef.current = 0;
    invalidateLaneRectCache(laneCacheRef.current);
    setMovingClipId(null);
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
    setInsertTargetFamily(null);
    setDragGhostState(null);
    cleanupExternalDragState();
  }
  resetMoveUiRef.current = resetMoveUi;

  function clientXToGhostLeft(clientX: number, grabOffsetX: number): number {
    const root = scrollContainerRef.current;
    if (!root) return 0;
    const rect = root.getBoundingClientRect();
    const mouseX =
      clientX - rect.left + root.scrollLeft - TIMELINE_PLAYHEAD_GUTTER_PX;
    return Math.max(0, mouseX - grabOffsetX);
  }

  function applyPointerMove(clientX: number, clientY: number) {
    const session = sessionRef.current;
    if (!session || !scrollContainerRef.current) return;

    if (!session.started) {
      const dx = clientX - session.originX;
      const dy = clientY - session.originY;
      if (dx * dx + dy * dy < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) return;
      session.started = true;
      const token = pointerSessionRef.current.token() ?? `clip-move_${session.id}`;
      session.cursorToken = token;
      acquireDragCursor(token);
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
        width: Math.max(session.duration * pps, 24),
        targetTrack: session.source === "audio" ? "audio" : "video",
      });
      invalidateLaneRectCache(laneCacheRef.current);
    }

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const left = clientXToGhostLeft(clientX, session.grabOffsetX);
    ghostLeftRef.current = left;

    const ghostWidth = Math.max(session.duration * pps, 24);
    setDragGhostLayout(left, ghostWidth);
    if (clientX > 0 && clientY > 0) {
      setDragCursor(clientX, clientY);
    }

    const ws = workspaceRef.current;
    if (!ws) return;

    autoScroll.updatePointer("clip-move", clientX, clientY, () => {
      invalidateLaneRectCache(laneCacheRef.current);
      applyPointerMoveRef.current(clientX, clientY);
    }, { sessionToken: session.cursorToken ?? undefined });

    const family = session.source === "audio" ? "audio" : "visual";
    const target =
      family === "audio"
        ? resolveAudioDropAtPointer(
            laneCacheRef.current,
            ws,
            clientY,
            dropTargetRef.current.isInsert,
            maxAudioOrderRef.current,
          )
        : resolveVisualDropAtPointer(
            laneCacheRef.current,
            ws,
            clientY,
            dropTargetRef.current.isInsert,
            maxOverlayOrderRef.current,
          );
    if (!target) return;
    applyDropTargetUpdate(target);

    const startTime = left / pps;
    const track =
      target.family === "audio"
        ? "audio"
        : target.overBaseBody
          ? "main"
          : "overlay";
    session.domain = updateClipMoveSessionState(
      session.domain,
      startTime,
      target.isInsert ? null : (target.laneId ?? session.originLaneId),
      track,
      target.isInsert,
      target.insertOrder,
    );
  }
  applyPointerMoveRef.current = applyPointerMove;

  /** Single path: TimelineDropTarget → dropTargetRef + insert-line / lane highlight. */
  function applyDropTargetUpdate(target: TimelineDropTarget) {
    const ui = dropTargetRef.current;
    const overBaseBody = Boolean(target.overBaseBody);
    const laneChanged = ui.laneId !== target.laneId;
    const insertChanged = ui.isInsert !== target.isInsert;
    const orderChanged = ui.insertOrder !== target.insertOrder;
    const baseChanged = ui.overBaseBody !== overBaseBody;
    const topChanged =
      target.isInsert &&
      Math.abs(ui.indicatorTop - target.indicatorTop) > INDICATOR_TOP_EPS_PX;
    if (
      !(
        insertChanged ||
        laneChanged ||
        orderChanged ||
        topChanged ||
        baseChanged
      )
    ) {
      return;
    }
    ui.isInsert = target.isInsert;
    ui.laneId = target.laneId;
    ui.insertOrder = target.insertOrder;
    ui.overBaseBody = overBaseBody;
    if (target.family === "audio") {
      setIsOverlayInsertLine(false);
      setTargetOverlayLaneId(null);
      if (insertChanged) setIsAudioInsertLine(target.isInsert);
      if (laneChanged) setTargetAudioLaneId(target.laneId);
    } else {
      setIsAudioInsertLine(false);
      setTargetAudioLaneId(null);
      if (insertChanged) setIsOverlayInsertLine(target.isInsert);
      if (laneChanged) setTargetOverlayLaneId(target.laneId);
    }
    setInsertTargetFamily(target.isInsert ? target.family : null);
    if (target.isInsert && (topChanged || insertChanged)) {
      ui.indicatorTop = target.indicatorTop;
      setIndicatorTopPos(target.indicatorTop);
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
    const ui = dropTargetRef.current;
    const track =
      session.source === "audio"
        ? "audio"
        : ui.isInsert
          ? "overlay"
          : ui.overBaseBody
            ? "main"
            : "overlay";
    session.domain = updateClipMoveSessionState(
      session.domain,
      startTime,
      ui.isInsert ? null : (ui.laneId ?? session.originLaneId),
      track,
      ui.isInsert,
      ui.insertOrder,
    );
    const patch = buildClipMovePatch(session.domain);
    store.moveClip(session.id, {
      track,
      startTime,
      laneId: patch.laneId ?? undefined,
      insertNewLane: patch.insertNewLane,
      insertOrder: patch.insertOrder ?? undefined,
    });
    resetMoveUi();
  }
  commitMoveRef.current = commitMove;

  function beginClipPointerDown(
    item: TimelineClip,
    family: "main" | "overlay" | "audio",
    event: ReactPointerEvent,
  ) {
    if (useEditorStore.getState().activeDragItem) {
      // Clean up stale activeDragItem from a previous canceled sidebar drag
      // so that timeline clip drags are not permanently blocked.
      useEditorStore.getState().setActiveDragItem(null);
      clearDragCursor();
    }

    event.stopPropagation();
    event.preventDefault();
    useEditorStore.getState().selectClip(item.id);

    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const clipLeft = item.startTime * pps;
    const pointerLeft = clientXToGhostLeft(event.clientX, 0);
    const grabOffsetX = Math.max(0, pointerLeft - clipLeft);
    const overBaseBody = family === "main";
    const seedLaneId = family === "main" ? null : item.laneId;

    dropTargetRef.current = {
      isInsert: false,
      laneId: seedLaneId,
      insertOrder: null,
      indicatorTop: 0,
      overBaseBody,
    };
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
    setInsertTargetFamily(null);

    if (family === "audio") {
      setTargetAudioLaneId(item.laneId);
      setTargetOverlayLaneId(null);
      setIsOverlayInsertLine(false);
    } else {
      setTargetOverlayLaneId(seedLaneId);
      setTargetAudioLaneId(null);
      setIsAudioInsertLine(false);
    }

    const started = pointerSession.begin({
      target: event.currentTarget,
      pointerId: event.pointerId,
      pos: { x: event.clientX, y: event.clientY },
    });
    if (!started) return;

    sessionRef.current = {
      source: family,
      id: item.id,
      name: item.name,
      duration: item.duration,
      originLaneId: item.laneId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetX,
      started: false,
      cursorToken: null,
      domain: createClipMoveSessionState(
        item.id,
        item.startTime,
        item.laneId,
        family,
      ),
      ...(family === "main" ? { clickSeekTime: item.startTime } : {}),
    };
  }

  function beginOverlayPointerDown(
    item: TimelineClip,
    event: ReactPointerEvent,
  ) {
    beginClipPointerDown(item, "overlay", event);
  }

  function beginMainPointerDown(item: TimelineClip, event: ReactPointerEvent) {
    beginClipPointerDown(item, "main", event);
  }

  function beginAudioPointerDown(item: TimelineClip, event: ReactPointerEvent) {
    beginClipPointerDown(item, "audio", event);
  }

  return {
    movingClipId,
    isOverlayInsertLine,
    isAudioInsertLine,
    insertTargetFamily,
    targetOverlayLaneId,
    targetAudioLaneId,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    beginClipPointerDown,
    /** @deprecated Prefer beginClipPointerDown(clip, "overlay", event). */
    beginOverlayPointerDown,
    /** @deprecated Prefer beginClipPointerDown(clip, "main", event). */
    beginMainPointerDown,
    /** @deprecated Prefer beginClipPointerDown(clip, "audio", event). */
    beginAudioPointerDown,
    isMoving: movingClipId != null,
  };
}
