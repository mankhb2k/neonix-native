"use client";

import { useLayoutEffect, useRef, useState, type DragEvent, type RefObject } from "react";
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
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";
import {
  createEmptyLaneRectCache,
  invalidateLaneRectCache,
  resolveAudioDropAtPointer,
  resolveVisualDropAtPointer,
  type LaneRectCache,
} from "./lane-drop-session";
import {
  CYAN_MODE_BELOW_RULER_TOP_PX,
  INDICATOR_TOP_EPS_PX,
} from "./lane-drop-target";

export type DragGhostState = {
  left: number;
  width: number;
  label: string;
  duration: number;
  targetTrack: "video" | "audio";
};

type UseTracksDragArgs = {
  rootRef: RefObject<HTMLDivElement | null>;
  rulerHeaderRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  maxOverlayOrder: number;
  maxAudioOrder: number;
  projectId: string | null;
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
  projectId,
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

  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const maxOverlayOrderRef = useRef(maxOverlayOrder);
  const maxAudioOrderRef = useRef(maxAudioOrder);
  const projectIdRef = useRef(projectId);
  pixelsPerSecondRef.current = pixelsPerSecond;
  maxOverlayOrderRef.current = maxOverlayOrder;
  maxAudioOrderRef.current = maxAudioOrder;
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
  const [dragGhostState, setDragGhostState] = useState<DragGhostState | null>(
    null,
  );

  const isInsertLine = isOverlayInsertLine || isAudioInsertLine;
  const hasDragGhost = dragGhostState != null;

  useLayoutEffect(() => {
    const ghostEl = insertGhostRef.current;
    if (!isInsertLine || !hasDragGhost) {
      unbindDragGhostElementIf(ghostEl);
      return undefined;
    }
    bindDragGhostElement(ghostEl, {
      leftOffset: TIMELINE_LABEL_WIDTH,
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
  }

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
      setDragOver(true);
    }

    if (!rootRef.current) return;
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const rect = rootRef.current.getBoundingClientRect();
    const scrollLeft = rootRef.current.scrollLeft;
    const mouseX =
      event.clientX - rect.left + scrollLeft - TIMELINE_LABEL_WIDTH;
    const hoverTime = Math.max(0, mouseX / pps);
    const left = hoverTime * pps;
    ghostLeftRef.current = left;

    const rulerTop =
      rulerHeaderRef.current?.getBoundingClientRect().top ?? rect.top;
    const currentlyOver = useEditorStore.getState().isOverTimeline;
    const nextOver = event.clientY >= rulerTop + CYAN_MODE_BELOW_RULER_TOP_PX;
    if (nextOver !== currentlyOver) {
      setIsOverTimeline(nextOver);
    }

    if (!nextOver) {
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
    const isAudio =
      dragItem?.type === "audio" || types.includes(AUDIO_LIBRARY_MIME);
    const duration = dragItem?.duration ?? 5;
    const label =
      dragItem?.name ?? (isAudio ? "Âm thanh" : "Khung hình");
    const ghostWidth = Math.max(duration * pps, 24);
    const targetTrack = isAudio ? "audio" : "video";
    const ghostKey = `${label}|${duration}|${ghostWidth}|${targetTrack}`;

    setDragGhostLayout(left, ghostWidth);
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }

    const ws = workspaceRef.current;
    if (isAudio) {
      if (dragUiRef.current.mode !== "audio") {
        dragUiRef.current.mode = "audio";
        dragUiRef.current.isInsert = false;
        dragUiRef.current.laneId = null;
        dragUiRef.current.insertOrder = null;
        clearVideoTarget();
      }
      if (ws) {
        const target = resolveAudioDropAtPointer(
          laneCacheRef.current,
          ws,
          event.clientY,
          dragUiRef.current.isInsert,
          maxAudioOrderRef.current,
        );
        if (target) {
          const ui = dragUiRef.current;
          const laneChanged = ui.laneId !== target.laneId;
          const insertChanged = ui.isInsert !== target.isInsert;
          const orderChanged = ui.insertOrder !== target.insertOrder;
          const topChanged =
            target.isInsert &&
            Math.abs(ui.indicatorTop - target.indicatorTop) >
              INDICATOR_TOP_EPS_PX;
          if (insertChanged || laneChanged || orderChanged || topChanged) {
            ui.isInsert = target.isInsert;
            ui.laneId = target.laneId;
            ui.insertOrder = target.insertOrder;
            if (insertChanged) setIsAudioInsertLine(target.isInsert);
            if (laneChanged) setTargetAudioLaneId(target.laneId);
            if (target.isInsert && (topChanged || insertChanged)) {
              ui.indicatorTop = target.indicatorTop;
              setIndicatorTopPos(target.indicatorTop);
            }
          }
        }
      }
    } else {
      if (dragUiRef.current.mode !== "video") {
        dragUiRef.current.mode = "video";
        dragUiRef.current.isInsert = false;
        dragUiRef.current.laneId = null;
        dragUiRef.current.insertOrder = null;
        clearAudioTarget();
      }
      if (ws) {
        const target = resolveVisualDropAtPointer(
          laneCacheRef.current,
          ws,
          event.clientY,
          dragUiRef.current.isInsert,
          maxOverlayOrderRef.current,
        );
        if (target) {
          const ui = dragUiRef.current;
          const laneChanged = ui.laneId !== target.laneId;
          const insertChanged = ui.isInsert !== target.isInsert;
          const orderChanged = ui.insertOrder !== target.insertOrder;
          const topChanged =
            target.isInsert &&
            Math.abs(ui.indicatorTop - target.indicatorTop) >
              INDICATOR_TOP_EPS_PX;
          if (insertChanged || laneChanged || orderChanged || topChanged) {
            ui.isInsert = target.isInsert;
            ui.laneId = target.laneId;
            ui.insertOrder = target.insertOrder;
            if (insertChanged) setIsOverlayInsertLine(target.isInsert);
            if (laneChanged) setTargetOverlayLaneId(target.laneId);
            if (target.isInsert && (topChanged || insertChanged)) {
              ui.indicatorTop = target.indicatorTop;
              setIndicatorTopPos(target.indicatorTop);
            }
          }
        }
      }
    }

    if (dragUiRef.current.ghostKey !== ghostKey) {
      dragUiRef.current.ghostKey = ghostKey;
      setDragGhostState({
        left,
        width: ghostWidth,
        label,
        duration,
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
    setDragOver(false);
    setIsOverlayInsertLine(false);
    setTargetOverlayLaneId(null);
    setIsAudioInsertLine(false);
    setTargetAudioLaneId(null);
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
      setDragGhostState(null);
    }
  }

  return {
    dragOver,
    isOverlayInsertLine,
    isAudioInsertLine,
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
