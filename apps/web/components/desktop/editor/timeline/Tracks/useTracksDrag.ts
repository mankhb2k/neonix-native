"use client";

import { useLayoutEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  bindDragGhostElement,
  clearDragCursor,
  setDragCursor,
  setDragGhostLayout,
  unbindDragGhostElementIf,
} from "@/lib/editor-drag-cursor";
import { FRAME_LIBRARY_MIME, getFrame } from "@/lib/frame-library";
import { AUDIO_LIBRARY_MIME } from "../../sidebar/AudioPanel/AudioPanel";
import {
  collectVideoLanes,
  resolveOverlayDragTarget,
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
  /** Live timeline scale — read via ref inside handlers to avoid stale closures. */
  pixelsPerSecond: number;
  uniqueLayers: number[];
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
  uniqueLayers,
  projectId,
}: UseTracksDragArgs) {
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);
  const addOverlaySceneFromFrame = useEditorStore(
    (s) => s.addOverlaySceneFromFrame,
  );
  const addSceneFromFrame = useEditorStore((s) => s.addSceneFromFrame);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);

  const insertGhostRef = useRef<HTMLDivElement>(null);
  const dragUiRef = useRef({
    dragOver: false,
    isInsert: false,
    layer: null as number | null,
    indicatorTop: 0,
    ghostKey: "" as string,
  });
  const ghostLeftRef = useRef(0);

  // Keep latest scale/layers/id for drag handlers without stale closures.
  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const uniqueLayersRef = useRef(uniqueLayers);
  const projectIdRef = useRef(projectId);
  pixelsPerSecondRef.current = pixelsPerSecond;
  uniqueLayersRef.current = uniqueLayers;
  projectIdRef.current = projectId;

  const [dragOver, setDragOver] = useState(false);
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
    // Trust store while dragging: always allow copy cursor on timeline.
    // dataTransfer.types can flicker mid-drag and would show not-allowed.
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

    const clearOverlayTarget = () => {
      const ui = dragUiRef.current;
      if (ui.isInsert || ui.layer != null) {
        ui.isInsert = false;
        ui.layer = null;
        setIsOverlayInsertLine(false);
        setTargetOverlayLayer(null);
      }
    };

    if (!nextOver) {
      if (event.clientX > 0 && event.clientY > 0) {
        setDragCursor(event.clientX, event.clientY);
      }
      clearOverlayTarget();
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

    if (!isAudio) {
      const ws = workspaceRef.current;
      if (ws) {
        const wsTop = ws.getBoundingClientRect().top;
        const lanes = collectVideoLanes(ws);
        const layers = uniqueLayersRef.current;
        const maxOverlayLayer = layers.length > 0 ? Math.max(...layers) : 0;
        const target = resolveOverlayDragTarget(
          event.clientY,
          lanes,
          wsTop,
          dragUiRef.current.isInsert,
          maxOverlayLayer,
        );
        if (target) {
          const ui = dragUiRef.current;
          const layerChanged = ui.layer !== target.layer;
          const insertChanged = ui.isInsert !== target.isInsert;
          const topChanged =
            target.isInsert &&
            Math.abs(ui.indicatorTop - target.indicatorTop) >
              INDICATOR_TOP_EPS_PX;
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
      }
    } else {
      clearOverlayTarget();
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
      layer: null,
      indicatorTop: 0,
      ghostKey: "",
    };
    setDragOver(false);
    setIsOverlayInsertLine(false);
    setTargetOverlayLayer(null);
    setDragGhostState(null);
    setIsOverTimeline(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const dropInsert = dragUiRef.current.isInsert;
    const dropLayer = dragUiRef.current.layer;
    const dropLeft = ghostLeftRef.current;
    const pps = Math.max(pixelsPerSecondRef.current, 1);
    const id = projectIdRef.current;

    dragUiRef.current = {
      dragOver: false,
      isInsert: false,
      layer: null,
      indicatorTop: 0,
      ghostKey: "",
    };
    setDragOver(false);
    setIsOverTimeline(false);
    setActiveDragItem(null);
    clearDragCursor();

    if (dropInsert || dropLayer !== null) {
      const frameId =
        event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
        event.dataTransfer.getData("text/plain");
      if (frameId && id) {
        const draft = getFrame(id, frameId);
        if (draft) {
          addOverlaySceneFromFrame(
            draft,
            dropLeft / pps,
            dropLayer ?? 0,
            dropInsert,
          );
        }
      }
      setIsOverlayInsertLine(false);
      setTargetOverlayLayer(null);
      setDragGhostState(null);
      return;
    }

    setDragGhostState(null);

    const audioData = event.dataTransfer.getData(AUDIO_LIBRARY_MIME);
    if (audioData) {
      try {
        const parsed = JSON.parse(audioData) as { title?: string };
        if (parsed.title) {
          addAudioTrack({ role: parsed.title, assetId: parsed.title });
        }
        return;
      } catch {
        // fallback to frame drop
      }
    }

    const frameId =
      event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!frameId || !id) return;
    const draft = getFrame(id, frameId);
    if (!draft) return;
    addSceneFromFrame(draft);
  }

  return {
    dragOver,
    isOverlayInsertLine,
    targetOverlayLayer,
    indicatorTopPos,
    dragGhostState,
    insertGhostRef,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
