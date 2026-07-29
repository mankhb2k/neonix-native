"use client";

import { useLayoutEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  unbindDragGhostElementIf,
} from "@/lib/editor/drag-cursor";
import { FRAME_LIBRARY_MIME } from "@/lib/editor/frame-library";
import { resolveFrameDraft } from "@/lib/editor/sidebar-mock-library";
import { AUDIO_LIBRARY_MIME } from "../../sidebar/AudioPanel/AudioPanel";
import {
  collectVideoLanes,
  collectAudioZoneLanes,
  resolveOverlayDragTarget,
  resolveAudioDragTarget,
  CYAN_MODE_BELOW_RULER_TOP_PX,
  INDICATOR_TOP_EPS_PX,
} from "./overlay-drag-target";
import { TIMELINE_LABEL_WIDTH } from "../timeline-scale";

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

function parseAudioDuration(duration: string | number | undefined): number {
  if (typeof duration === "number" && Number.isFinite(duration)) {
    return Math.max(0.5, duration);
  }
  if (typeof duration !== "string") return 10;
  const parts = duration.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return Math.max(0.5, parts[0] * 60 + parts[1]);
  }
  return 10;
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
  const dragUiRef = useRef({
    dragOver: false,
    isInsert: false,
    laneId: null as string | null,
    insertOrder: null as number | null,
    indicatorTop: 0,
    ghostKey: "" as string,
    mode: "video" as "video" | "audio",
  });
  const ghostLeftRef = useRef(0);

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
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragOver(event: DragEvent) {
    const dragItem = useEditorStore.getState().activeDragItem;
    if (!dragItem && !isEditorDragTypes(Array.from(event.dataTransfer.types))) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
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
        const wsTop = ws.getBoundingClientRect().top;
        const lanes = collectAudioZoneLanes(ws);
        const target = resolveAudioDragTarget(
          event.clientY,
          lanes,
          wsTop,
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
        const wsTop = ws.getBoundingClientRect().top;
        const lanes = collectVideoLanes(ws);
        const target = resolveOverlayDragTarget(
          event.clientY,
          lanes,
          wsTop,
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
    const dropMode = dragUiRef.current.mode;
    const dropInsert = dragUiRef.current.isInsert;
    const dropLaneId = dragUiRef.current.laneId;
    const dropInsertOrder = dragUiRef.current.insertOrder;
    const dropLeft = ghostLeftRef.current;
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const id = projectIdRef.current;

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

    if (dropMode === "audio") {
      const audioData = event.dataTransfer.getData(AUDIO_LIBRARY_MIME);
      let title = "Âm thanh";
      let assetId = `audio_${Date.now().toString(36)}`;
      let duration = 10;
      if (audioData) {
        try {
          const parsed = JSON.parse(audioData) as {
            id?: string;
            title?: string;
            duration?: string | number;
          };
          if (parsed.title) title = parsed.title;
          if (parsed.id) assetId = parsed.id;
          duration = parseAudioDuration(parsed.duration);
        } catch {
          // keep defaults
        }
      } else {
        const dragItem = useEditorStore.getState().activeDragItem;
        if (dragItem?.type === "audio") {
          title = dragItem.name;
          assetId = dragItem.id;
          duration = dragItem.duration;
        }
      }
      addAudioClipFromLibrary(
        { title, assetId, duration },
        {
          startTime: dropLeft / pps,
          laneId: dropLaneId ?? undefined,
          insertNewLane: dropInsert || dropLaneId == null,
          ...(dropInsert && dropInsertOrder != null
            ? { insertOrder: dropInsertOrder }
            : {}),
        },
      );
      return;
    }

    if (dropInsert || dropLaneId !== null) {
      const frameId =
        event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
        event.dataTransfer.getData("text/plain");
      if (frameId && id) {
        const draft = resolveFrameDraft(id, frameId);
        if (draft) {
          addClipFromDraft(draft, {
            track: "overlay",
            startTime: dropLeft / pps,
            laneId: dropLaneId ?? undefined,
            insertNewLane: dropInsert,
            ...(dropInsert && dropInsertOrder != null
              ? { layerIndex: dropInsertOrder }
              : {}),
          });
        }
      }
      return;
    }

    const frameId =
      event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!frameId || !id) return;
    const draft = resolveFrameDraft(id, frameId);
    if (!draft) return;
    addClipFromDraft(draft, { track: "main" });
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
