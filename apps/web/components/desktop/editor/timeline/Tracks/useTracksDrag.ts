"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import {
  AUDIO_LIBRARY_MIME,
  normalizeAudioDurationSec,
  parseAudioLibraryPayload,
} from "@/lib/editor/dnd/editor-drag-payload";
import {
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  unbindDragGhostElementIf,
} from "@/lib/editor/drag-cursor";
import { useEditorStore } from "@/lib/editor/editor-store";
import { FRAME_LIBRARY_MIME } from "@/lib/editor/frame-library";
import { resolveFrameDraft } from "@/lib/editor/sidebar-mock-library";
import {
  bindLaneCacheInvalidation,
  createEmptyLaneRectCache,
  invalidateLaneRectCache,
  resolveAudioDropAtPointer,
  resolveVisualDropAtPointer,
  type LaneRectCache,
} from "./lane-drop-session";
import {
  CYAN_MODE_BELOW_RULER_TOP_PX,
  INDICATOR_TOP_EPS_PX,
  type TimelineDropTarget,
} from "./lane-drop-target";
import type { TimelineAutoScrollController } from "./useTimelineAutoScroll";

/** Lane ghost preview — chỉ field UI thật sự render. */
export type DragGhostState = {
  width: number;
  targetTrack: "video" | "audio";
};

type UseTracksDragArgs = {
  rootRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  maxOverlayOrder: number;
  maxAudioOrder: number;
  /** First visual clip must establish the single base lane, never an overlay. */
  visualBaseOnly: boolean;
  projectId: string | null;
  autoScroll: TimelineAutoScrollController;
};

function isEditorDragTypes(types: readonly string[]): boolean {
  return (
    types.includes(FRAME_LIBRARY_MIME) ||
    types.includes(AUDIO_LIBRARY_MIME) ||
    types.includes("application/json") ||
    types.includes("text/plain")
  );
}

export function useTracksDrag({
  rootRef,
  rulerHeaderRef,
  workspaceRef,
  pixelsPerSecond,
  maxOverlayOrder,
  maxAudioOrder,
  visualBaseOnly,
  projectId,
  autoScroll,
}: UseTracksDragArgs) {
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);
  const addClipFromDraft = useEditorStore((s) => s.addClipFromDraft);
  const addAudioClipFromLibrary = useEditorStore((s) => s.addAudioClipFromLibrary);

  const insertGhostRef = useRef<HTMLDivElement>(null);
  const dragUiRef = useRef<{
    dragOver: boolean;
    isInsert: boolean;
    laneId: string | null;
    insertOrder: number | null;
    indicatorTop: number;
    ghostKey: string;
    mode: "video" | "audio";
  }>({
    dragOver: false,
    isInsert: false,
    laneId: null,
    insertOrder: null,
    indicatorTop: 0,
    ghostKey: "",
    mode: "video",
  });
  const ghostLeftRef = useRef(0);
  const laneCacheRef = useRef<LaneRectCache>(createEmptyLaneRectCache());
  const lastDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
    ghostWidth: number;
  } | null>(null);
  const refreshDragPositionRef = useRef<
    (clientX: number, clientY: number, ghostWidth: number) => void
  >(() => undefined);

  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const maxOverlayOrderRef = useRef(maxOverlayOrder);
  const maxAudioOrderRef = useRef(maxAudioOrder);
  const visualBaseOnlyRef = useRef(visualBaseOnly);
  const projectIdRef = useRef(projectId);
  pixelsPerSecondRef.current = pixelsPerSecond;
  maxOverlayOrderRef.current = maxOverlayOrder;
  maxAudioOrderRef.current = maxAudioOrder;
  visualBaseOnlyRef.current = visualBaseOnly;
  projectIdRef.current = projectId;

  const [dragOver, setDragOver] = useState(false);
  const [isOverlayInsertLine, setIsOverlayInsertLine] = useState(false);
  const [targetOverlayLaneId, setTargetOverlayLaneId] = useState<string | null>(
    null,
  );
  const [isAudioInsertLine, setIsAudioInsertLine] = useState(false);
  const [targetAudioLaneId, setTargetAudioLaneId] = useState<string | null>(
    null,
  );
  const [indicatorTopPos, setIndicatorTopPos] = useState(0);
  /** Family that produced the current insertion indicator. Never share an audio
   * indicator with a visual drag (or vice versa). */
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

  function clearVideoTarget() {
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
  }

  function clearAudioTarget() {
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
  }

  function clearAllTargets() {
    dragUiRef.current.isInsert = false;
    dragUiRef.current.laneId = null;
    dragUiRef.current.insertOrder = null;
    invalidateLaneRectCache(laneCacheRef.current);
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
    setInsertTargetFamily(null);
  }

  /** Clear store/global drag chrome without local React setters (safe on unmount). */
  function cleanupExternalDragState() {
    useEditorStore.getState().setIsOverTimeline(false);
    useEditorStore.getState().setActiveDragItem(null);
    clearDragCursor();
    unbindDragGhostElementIf(insertGhostRef.current);
  }

  useEffect(() => {
    return () => {
      autoScroll.stop("sidebar-drag");
      cleanupExternalDragState();
    };
  }, [autoScroll]);

  useEffect(
    () =>
      bindLaneCacheInvalidation(
        rootRef,
        workspaceRef,
        laneCacheRef.current,
        () => {
          const last = lastDragPointerRef.current;
          if (last) {
            refreshDragPositionRef.current(
              last.clientX,
              last.clientY,
              last.ghostWidth,
            );
          }
        },
      ),
    [rootRef, workspaceRef],
  );

  function applyDropTarget(target: TimelineDropTarget) {
    const ui = dragUiRef.current;
    const laneChanged = ui.laneId !== target.laneId;
    const insertChanged = ui.isInsert !== target.isInsert;
    const orderChanged = ui.insertOrder !== target.insertOrder;
    const topChanged =
      target.isInsert &&
      Math.abs(ui.indicatorTop - target.indicatorTop) >
        INDICATOR_TOP_EPS_PX;
    if (!(insertChanged || laneChanged || orderChanged || topChanged)) return;

    ui.isInsert = target.isInsert;
    ui.laneId = target.laneId;
    ui.insertOrder = target.insertOrder;
    setInsertTargetFamily(target.isInsert ? target.family : null);

    if (target.family === "audio") {
      clearVideoTarget();
      if (insertChanged) setIsAudioInsertLine(target.isInsert);
      if (laneChanged) setTargetAudioLaneId(target.laneId);
    } else {
      clearAudioTarget();
      if (insertChanged) setIsOverlayInsertLine(target.isInsert);
      if (laneChanged) setTargetOverlayLaneId(target.laneId);
    }

    if (target.isInsert && (topChanged || insertChanged)) {
      ui.indicatorTop = target.indicatorTop;
      setIndicatorTopPos(target.indicatorTop);
    }
  }

  function refreshDragPosition(
    clientX: number,
    clientY: number,
    ghostWidth: number,
  ) {
    const root = rootRef.current;
    const ws = workspaceRef.current;
    if (!root || !ws) return;

    const bounds = root.getBoundingClientRect();
    const mouseX = clientX - bounds.left + root.scrollLeft;
    const left = Math.max(0, mouseX);
    ghostLeftRef.current = left;
    setDragGhostLayout(left, ghostWidth);

    const target =
      dragUiRef.current.mode === "audio"
        ? resolveAudioDropAtPointer(
            laneCacheRef.current,
            ws,
            clientY,
            dragUiRef.current.isInsert,
            maxAudioOrderRef.current,
          )
        : visualBaseOnlyRef.current
          ? {
              family: "visual" as const,
              isInsert: false,
              laneId: null,
              insertOrder: null,
              indicatorTop: 0,
              overBaseBody: true,
            }
          : resolveVisualDropAtPointer(
              laneCacheRef.current,
              ws,
              clientY,
              dragUiRef.current.isInsert,
              maxOverlayOrderRef.current,
            );
    if (target) applyDropTarget(target);
  }

  refreshDragPositionRef.current = refreshDragPosition;

  function handleDragEnter(event: DragEvent) {
    const dragItem = useEditorStore.getState().activeDragItem;
    if (!dragItem && !isEditorDragTypes(Array.from(event.dataTransfer.types))) {
      return;
    }
    event.preventDefault();
    Object.assign(event.dataTransfer, { dropEffect: "copy" as const });
  }

  function handleDragOver(event: DragEvent) {
    const dragItem = useEditorStore.getState().activeDragItem;
    if (!dragItem && !isEditorDragTypes(Array.from(event.dataTransfer.types))) {
      return;
    }

    event.preventDefault();
    Object.assign(event.dataTransfer, { dropEffect: "copy" as const });
    if (!dragUiRef.current.dragOver) {
      dragUiRef.current.dragOver = true;
      invalidateLaneRectCache(laneCacheRef.current);
      setDragOver(true);
    }

    if (!rootRef.current) return;
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const rect = rootRef.current.getBoundingClientRect();

    const rulerTop =
      rulerHeaderRef.current?.getBoundingClientRect().top ?? rect.top;
    const currentlyOver = useEditorStore.getState().isOverTimeline;
    const nextOver = event.clientY >= rulerTop + CYAN_MODE_BELOW_RULER_TOP_PX;
    if (nextOver !== currentlyOver) {
      setIsOverTimeline(nextOver);
    }

    if (!nextOver) {
      autoScroll.stop("sidebar-drag");
      lastDragPointerRef.current = null;
      if (event.clientX > 0 && event.clientY > 0) {
        setDragCursor(event.clientX, event.clientY);
      }
      clearAllTargets();
      if (dragUiRef.current.ghostKey !== "") {
        dragUiRef.current.ghostKey = "";
        setDragGhostState(null);
      }
      return;
    }

    const types = Array.from(event.dataTransfer.types);
    // Store payload is authoritative. DataTransfer is only a fallback for
    // external/native drags; otherwise a stale MIME must not turn a frame
    // into an audio drop target.
    const isAudio = dragItem
      ? dragItem.type === "audio"
      : types.includes(AUDIO_LIBRARY_MIME);
    const duration = dragItem?.duration ?? 5;
    const label =
      dragItem?.name ?? (isAudio ? "Âm thanh" : "Khung hình");
    const ghostWidth = Math.max(duration * pps, 24);
    const targetTrack = isAudio ? "audio" : "video";
    const ghostKey = `${label}|${duration}|${ghostWidth}|${targetTrack}`;

    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }

    if (isAudio) {
      if (dragUiRef.current.mode !== "audio") {
        dragUiRef.current.mode = "audio";
        dragUiRef.current.isInsert = false;
        dragUiRef.current.laneId = null;
        dragUiRef.current.insertOrder = null;
        clearVideoTarget();
      }
    } else {
      if (dragUiRef.current.mode !== "video") {
        dragUiRef.current.mode = "video";
        dragUiRef.current.isInsert = false;
        dragUiRef.current.laneId = null;
        dragUiRef.current.insertOrder = null;
        clearAudioTarget();
      }
    }

    lastDragPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      ghostWidth,
    };
    refreshDragPosition(event.clientX, event.clientY, ghostWidth);
    autoScroll.updatePointer(
      "sidebar-drag",
      event.clientX,
      event.clientY,
      () => {
        invalidateLaneRectCache(laneCacheRef.current);
        const last = lastDragPointerRef.current;
        if (last) {
          refreshDragPosition(last.clientX, last.clientY, last.ghostWidth);
        }
      },
    );

    if (dragUiRef.current.ghostKey !== ghostKey) {
      dragUiRef.current.ghostKey = ghostKey;
      setDragGhostState({
        width: ghostWidth,
        targetTrack,
      });
    }
  }

  function handleDragLeave(event: DragEvent) {
    const root = rootRef.current;
    if (!root) return;

    const related = event.relatedTarget as Node | null;
    if (related && root.contains(related)) return;

    const { clientX, clientY } = event;
    const bounds = root.getBoundingClientRect();
    if (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    ) {
      return;
    }

    dragUiRef.current = {
      dragOver: false,
      isInsert: false,
      laneId: null,
      insertOrder: null,
      indicatorTop: 0,
      ghostKey: "",
      mode: "video",
    };
    autoScroll.stop("sidebar-drag");
    lastDragPointerRef.current = null;
    invalidateLaneRectCache(laneCacheRef.current);
    setDragOver(false);
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
    setInsertTargetFamily(null);
    setDragGhostState(null);
    setIsOverTimeline(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    // DND-02: snapshot payload + active item TRƯỚC khi reset UI drag session.
    const dropMode = dragUiRef.current.mode;
    const dropInsert = dragUiRef.current.isInsert;
    const dropLaneId = dragUiRef.current.laneId;
    const dropInsertOrder = dragUiRef.current.insertOrder;
    const dropLeft = ghostLeftRef.current;
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const id = projectIdRef.current;
    const activeDragItem = useEditorStore.getState().activeDragItem;
    const audioRaw = event.dataTransfer.getData(AUDIO_LIBRARY_MIME);
    const frameId =
      event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
      event.dataTransfer.getData("text/plain");

    try {
      if (dropMode === "audio") {
        const parsed = audioRaw ? parseAudioLibraryPayload(audioRaw) : null;
        let title = "Âm thanh";
        let assetId = `audio_${Date.now().toString(36)}`;
        let duration = 10;
        if (parsed) {
          title = parsed.title;
          assetId = parsed.id;
          duration = parsed.duration;
        } else if (activeDragItem?.type === "audio") {
          title = activeDragItem.name;
          assetId = activeDragItem.id;
          duration = normalizeAudioDurationSec(activeDragItem.duration);
        }
        addAudioClipFromLibrary(
          { title, assetId, duration },
          dropInsert || dropLaneId == null
            ? {
                startTime: dropLeft / pps,
                insertNewLane: true,
                ...(dropInsertOrder != null
                  ? { insertOrder: dropInsertOrder }
                  : {}),
              }
            : {
                startTime: dropLeft / pps,
                laneId: dropLaneId,
              },
        );
        return;
      }

      if (dropInsert || dropLaneId !== null) {
        if (frameId && id) {
          const draft = resolveFrameDraft(id, frameId);
          if (draft) {
            addClipFromDraft(
              draft,
              dropInsert
                ? {
                    track: "overlay",
                    startTime: dropLeft / pps,
                    insertNewLane: true,
                    ...(dropInsertOrder != null
                      ? { insertOrder: dropInsertOrder }
                      : {}),
                  }
                : {
                    track: "overlay",
                    startTime: dropLeft / pps,
                    laneId: dropLaneId ?? undefined,
                  },
            );
          }
        }
        return;
      }

      if (!frameId || !id) return;
      const draft = resolveFrameDraft(id, frameId);
      if (!draft) return;
      addClipFromDraft(draft, { track: "main" });
    } finally {
      autoScroll.stop("sidebar-drag");
      lastDragPointerRef.current = null;
      invalidateLaneRectCache(laneCacheRef.current);
      dragUiRef.current = {
        dragOver: false,
        isInsert: false,
        laneId: null,
        insertOrder: null,
        indicatorTop: 0,
        ghostKey: "",
        mode: "video",
      };
      setDragOver(false);
      setIsOverTimeline(false);
      setActiveDragItem(null);
      clearDragCursor();
      setIsOverlayInsertLine(false);
      setTargetOverlayLaneId(null);
      setIsAudioInsertLine(false);
      setTargetAudioLaneId(null);
      setInsertTargetFamily(null);
      setDragGhostState(null);
    }
  }

  return {
    dragOver,
    isOverlayInsertLine,
    isAudioInsertLine,
    insertTargetFamily,
    isInsertLine,
    targetOverlayLaneId,
    targetAudioLaneId,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
