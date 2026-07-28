"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  Film,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { clearDragCursor, setDragCursor, setDragGhostLayout, bindDragGhostElement, unbindDragGhostElementIf } from "@/lib/editor-drag-cursor";
import { FRAME_LIBRARY_MIME, getFrame } from "@/lib/frame-library";
import { AUDIO_LIBRARY_MIME } from "../../sidebar/AudioPanel/AudioPanel";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { TrackLane } from "./TrackLane";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PPS_MIN,
  maxPixelsPerSecondForView,
  timelineCanvasDuration,
  timelineWorkspaceSeconds,
  zoomToPixelsPerSecond,
} from "../timeline-scale";

type Props = {
  zoom: number;
};

/** px below TimeRuler top border — single threshold for card↔cyan (enter & exit) */
const CYAN_MODE_BELOW_RULER_TOP_PX = 16;
/** Enter insert-line mode only when within this many px of a lane edge */
const OVERLAY_EDGE_ENTER_PX = 2;
/** Exit insert-line only when this far into the lane body (hysteresis) */
const OVERLAY_EDGE_EXIT_PX = 10;
/** Skip indicator setState when Y barely moved (cuts dragover re-renders) */
const INDICATOR_TOP_EPS_PX = 0.5;

type VideoLaneHit = {
  top: number;
  bottom: number;
  type: "overlay" | "main";
  layerIndex: number | null;
};

type OverlayDragTarget = {
  isInsert: boolean;
  layer: number | null;
  indicatorTop: number;
};

function collectVideoLanes(scope: HTMLElement): VideoLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: VideoLaneHit[] = [];
  for (const el of nodes) {
    const type = el.getAttribute("data-track-type");
    if (type !== "overlay" && type !== "main") continue;
    const r = el.getBoundingClientRect();
    const layerAttr = el.getAttribute("data-layer-index");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      layerIndex: layerAttr != null ? Number.parseInt(layerAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

function gapMidInWs(upper: VideoLaneHit, lower: VideoLaneHit, wsTop: number): number {
  return (upper.bottom + lower.top) / 2 - wsTop;
}

function resolveInsideLane(
  clientY: number,
  lane: VideoLaneHit,
  next: VideoLaneHit | undefined,
  prev: VideoLaneHit | undefined,
  wsTop: number,
  wasInsert: boolean,
): OverlayDragTarget {
  const relY = clientY - lane.top;
  const h = Math.max(lane.bottom - lane.top, 1);
  const inBodyClear =
    relY > OVERLAY_EDGE_EXIT_PX && relY < h - OVERLAY_EDGE_EXIT_PX;
  const nearTopEnter = relY <= OVERLAY_EDGE_ENTER_PX;
  const nearBottomEnter = relY >= h - OVERLAY_EDGE_ENTER_PX;

  const insertAbove = (): OverlayDragTarget => {
    const indicatorTop =
      prev != null ? gapMidInWs(prev, lane, wsTop) : lane.top - wsTop - 1;
    if (lane.type === "overlay" && lane.layerIndex != null) {
      return { isInsert: true, layer: lane.layerIndex + 1, indicatorTop };
    }
    return { isInsert: true, layer: 0, indicatorTop };
  };

  const insertBelow = (): OverlayDragTarget => {
    if (lane.type !== "overlay" || lane.layerIndex == null) {
      return { isInsert: false, layer: null, indicatorTop: 0 };
    }
    const indicatorTop =
      next != null ? gapMidInWs(lane, next, wsTop) : lane.bottom - wsTop - 1;
    return { isInsert: true, layer: lane.layerIndex, indicatorTop };
  };

  const body = (): OverlayDragTarget => {
    if (lane.type === "overlay" && lane.layerIndex != null) {
      return { isInsert: false, layer: lane.layerIndex, indicatorTop: 0 };
    }
    return { isInsert: false, layer: null, indicatorTop: 0 };
  };

  if (lane.type === "main") {
    if (!wasInsert) {
      if (nearTopEnter) return insertAbove();
      return body();
    }
    if (relY > OVERLAY_EDGE_EXIT_PX) return body();
    return insertAbove();
  }

  if (!wasInsert) {
    if (nearTopEnter) return insertAbove();
    if (nearBottomEnter) return insertBelow();
    return body();
  }
  if (inBodyClear) return body();
  if (relY < h / 2) return insertAbove();
  return insertBelow();
}

/**
 * Rect-based hit test (no elementFromPoint). Gaps between lanes always map to
 * "insert below upper" so the cyan line target does not flip each pixel.
 */
function resolveOverlayDragTarget(
  clientY: number,
  lanes: VideoLaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxOverlayLayer: number,
): OverlayDragTarget | null {
  if (lanes.length === 0) return null;

  const first = lanes[0];
  if (clientY < first.top) {
    return {
      isInsert: true,
      layer: maxOverlayLayer + 1,
      indicatorTop: first.top - wsTop - 1,
    };
  }

  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const next = lanes[i + 1];
    const prev = i > 0 ? lanes[i - 1] : undefined;

    // Gap → canonical "below upper" (never flip to "above lower")
    if (next && clientY > lane.bottom && clientY < next.top) {
      if (lane.type === "overlay" && lane.layerIndex != null) {
        return {
          isInsert: true,
          layer: lane.layerIndex,
          indicatorTop: gapMidInWs(lane, next, wsTop),
        };
      }
      return {
        isInsert: true,
        layer: 0,
        indicatorTop: gapMidInWs(lane, next, wsTop),
      };
    }

    if (clientY >= lane.top && clientY <= lane.bottom) {
      return resolveInsideLane(clientY, lane, next, prev, wsTop, wasInsert);
    }
  }

  const last = lanes[lanes.length - 1];
  const prev = lanes.length > 1 ? lanes[lanes.length - 2] : undefined;
  return resolveInsideLane(clientY, last, undefined, prev, wsTop, wasInsert);
}

export function Tracks({ zoom }: Props) {
  const scenes = useEditorStore((s) => s.project?.scenes);
  const projectId = useEditorStore((s) => s.project?.metadata.id);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const audioTracks = useEditorStore((s) => s.project?.timeline.audioTracks);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const addSceneFromFrame = useEditorStore((s) => s.addSceneFromFrame);
  const addOverlaySceneFromFrame = useEditorStore(
    (s) => s.addOverlaySceneFromFrame,
  );
  const overlayScenes = useEditorStore((s) => s.overlayScenes);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const rootRef = useRef<HTMLDivElement>(null);
  const rulerHeaderRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const insertGhostRef = useRef<HTMLDivElement>(null);
  /** Mirrors drag UI so dragover can skip redundant setState (stops not-allowed flicker). */
  const dragUiRef = useRef({
    dragOver: false,
    isInsert: false,
    layer: null as number | null,
    indicatorTop: 0,
    ghostKey: "" as string,
  });
  /** Drop time uses live X; avoid putting left into React every dragover. */
  const ghostLeftRef = useRef(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [isOverlayInsertLine, setIsOverlayInsertLine] = useState(false);
  const [targetOverlayLayer, setTargetOverlayLayer] = useState<number | null>(
    null,
  );
  const [indicatorTopPos, setIndicatorTopPos] = useState<number>(0);

  // Track control states (CapCut style)
  const [videoLocked, setVideoLocked] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [dragGhostState, setDragGhostState] = useState<{
    left: number;
    width: number;
    label: string;
    duration: number;
    targetTrack: "video" | "audio";
  } | null>(null);

  // Re-bind when project appears: first paint often returns null (no DOM),
  // so a mount-only effect would leave viewWidth stuck at 0 forever.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scenes]);

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

  if (!scenes || !projectId || !audioTracks) {
    return <div ref={rootRef} className="relative flex-1 overflow-auto" />;
  }

  const total = scenes.reduce((sum, s) => sum + s.duration, 0);
  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const workspaceSeconds = timelineWorkspaceSeconds(total);
  const floorPps =
    trackViewWidth > 0 ? trackViewWidth / workspaceSeconds : TIMELINE_PPS_MIN;
  const ceilingPps = maxPixelsPerSecondForView(trackViewWidth, fps);
  const pixelsPerSecond = zoomToPixelsPerSecond(zoom, floorPps, ceilingPps);
  const rulerDuration = timelineCanvasDuration(
    total,
    pixelsPerSecond,
    trackViewWidth,
  );
  const canvasWidth = rulerDuration * pixelsPerSecond;
  const playheadLeft = TIMELINE_LABEL_WIDTH + currentTime * pixelsPerSecond;
  const isEmpty = scenes.length === 0;

  let cursor = 0;
  const sceneBlocks = scenes.map((scene, index) => {
    const left = cursor * pixelsPerSecond;
    const width = Math.max(scene.duration * pixelsPerSecond, 8);
    cursor += scene.duration;
    return { scene, index, left, width, startTime: cursor - scene.duration };
  });

  // Unique sorted overlay layers (descending: highest layerIndex on top, 0 just above Main)
  const uniqueLayers = Array.from(
    new Set(overlayScenes.map((item) => item.layerIndex)),
  ).sort((a, b) => b - a);

  function handleDragOver(event: React.DragEvent) {
    const dragItem = useEditorStore.getState().activeDragItem;
    // Trust store while dragging: always allow copy cursor on timeline.
    // dataTransfer.types can flicker mid-drag and would show not-allowed.
    if (!dragItem) {
      const types = Array.from(event.dataTransfer.types);
      if (
        !types.includes(FRAME_LIBRARY_MIME) &&
        !types.includes(AUDIO_LIBRARY_MIME) &&
        !types.includes("application/json") &&
        !types.includes("text/plain")
      ) {
        return;
      }
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dragUiRef.current.dragOver) {
      dragUiRef.current.dragOver = true;
      setDragOver(true);
    }

    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const scrollLeft = rootRef.current.scrollLeft;
    const mouseX =
      event.clientX - rect.left + scrollLeft - TIMELINE_LABEL_WIDTH;
    const hoverTime = Math.max(0, mouseX / Math.max(pixelsPerSecond, 1));
    const left = hoverTime * pixelsPerSecond;
    ghostLeftRef.current = left;

    // Single threshold vs TimeRuler top border: same line for card↔cyan.
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

    // Above threshold as card mode: no lane ghosts (prevents flash under ruler).
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
    const ghostWidth = Math.max(duration * pixelsPerSecond, 24);
    const targetTrack = isAudio ? "audio" : "video";
    const ghostKey = `${label}|${duration}|${ghostWidth}|${targetTrack}`;

    // Same rAF as cyan — gray left/width stay in lockstep (imperative; no React).
    setDragGhostLayout(left, ghostWidth);
    // Cyan left edge on cursor (= gray ghost left under pointer); no +ghostWidth/2.
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }

    if (!isAudio) {
      const ws = workspaceRef.current;
      if (ws) {
        const wsTop = ws.getBoundingClientRect().top;
        const lanes = collectVideoLanes(ws);
        const maxOverlayLayer =
          uniqueLayers.length > 0 ? Math.max(...uniqueLayers) : 0;
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

  function handleDragLeave(event: React.DragEvent) {
    const root = rootRef.current;
    if (!root) return;

    const related = event.relatedTarget as Node | null;
    if (related && root.contains(related)) return;

    // HTML5 drag often gives null relatedTarget — ignore leave while still inside bounds.
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

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const dropInsert = dragUiRef.current.isInsert;
    const dropLayer = dragUiRef.current.layer;
    const dropLeft = ghostLeftRef.current;

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
      if (frameId && projectId) {
        const draft = getFrame(projectId, frameId);
        if (draft) {
          const dropTime = dropLeft / Math.max(pixelsPerSecond, 1);
          addOverlaySceneFromFrame(
            draft,
            dropTime,
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
        const parsed = JSON.parse(audioData);
        addAudioTrack({ role: parsed.title, assetId: parsed.title });
        return;
      } catch (e) {
        // fallback
      }
    }

    const frameId =
      event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!frameId || !projectId) return;
    const draft = getFrame(projectId, frameId);
    if (!draft) return;
    addSceneFromFrame(draft);
  }

  return (
    <div
      ref={rootRef}
      className={`relative flex-1 overflow-auto transition-colors select-none bg-[var(--bg-panel)] ${
        dragOver ? "bg-[var(--accent-soft)]/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragEnter={(event) => {
        // Some browsers need dragenter preventDefault for a stable copy cursor.
        const dragItem = useEditorStore.getState().activeDragItem;
        if (!dragItem) {
          const types = Array.from(event.dataTransfer.types);
          if (
            !types.includes(FRAME_LIBRARY_MIME) &&
            !types.includes(AUDIO_LIBRARY_MIME) &&
            !types.includes("application/json") &&
            !types.includes("text/plain")
          ) {
            return;
          }
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="relative min-h-full flex flex-col flex-1"
        style={{ minWidth: TIMELINE_LABEL_WIDTH + canvasWidth }}
      >
        {/* Playhead Vertical Line & Time Badge */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-[var(--timeline-playhead)]"
          style={{ left: playheadLeft }}
        >
          <div className="absolute top-0 left-1/2 flex h-3.5 min-w-3.5 -translate-x-1/2 items-center justify-center rounded-sm bg-[var(--timeline-playhead)] px-1 font-mono text-[9px] font-semibold text-[var(--bg-panel)]">
            {currentTime.toFixed(1)}
          </div>
        </div>

        {/* 1. TimeRuler Header Bar (Sticky Top 0, Z-Index 40) */}
        <div
          ref={rulerHeaderRef}
          className="sticky top-0 z-40 flex bg-[var(--bg-panel)]"
        >
          <div
            className="sticky left-0 z-40 shrink-0 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]"
            style={{ width: TIMELINE_LABEL_WIDTH, height: 28 }}
          />
          <TimeRuler
            duration={rulerDuration}
            fps={fps}
            pixelsPerSecond={pixelsPerSecond}
            width={canvasWidth}
          />
        </div>

        {/* 2. Track Workspace Area (With Top Gap & Bottom Gap on scroll) */}
        {isEmpty ? (
          <div className="flex flex-1 min-h-[160px] items-center pt-6 pb-12">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center justify-center gap-1.5 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] px-2 h-full"
              style={{ width: TIMELINE_LABEL_WIDTH }}
            >
              <button
                type="button"
                className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                title="Khung hình / Video"
              >
                <Film size={14} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setVideoLocked(!videoLocked)}
                className={`p-1 transition-colors rounded cursor-pointer ${
                  videoLocked
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                }`}
                title={videoLocked ? "Mở khóa Track Video" : "Khóa Track Video"}
              >
                {videoLocked ? (
                  <Lock size={14} strokeWidth={1.75} />
                ) : (
                  <Unlock size={14} strokeWidth={1.75} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setVideoVisible(!videoVisible)}
                className={`p-1 transition-colors rounded cursor-pointer ${
                  !videoVisible
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                }`}
                title={videoVisible ? "Ẩn Track Video" : "Hiện Track Video"}
              >
                {videoVisible ? (
                  <Eye size={14} strokeWidth={1.75} />
                ) : (
                  <EyeOff size={14} strokeWidth={1.75} />
                )}
              </button>
            </div>

            <div
              className="sticky flex items-center justify-center px-6"
              style={{
                left: TIMELINE_LABEL_WIDTH,
                width:
                  trackViewWidth > 0 ? trackViewWidth : "calc(100% - 96px)",
              }}
            >
              <div
                className={`flex h-11 w-full max-w-[480px] items-center justify-center gap-2.5 rounded-lg border border-dashed px-4 transition-all select-none ${
                  dragOver
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] scale-[1.01]"
                    : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-muted)]"
                }`}
              >
                <Film size={16} strokeWidth={1.5} className="shrink-0" />
                <span className="text-[12px] font-medium tracking-wide truncate">
                  Kéo khung hình hoặc phương tiện vào đây để bắt đầu tạo
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={workspaceRef}
            className="relative flex flex-1 flex-col pt-[40px] pb-10 space-y-[2px]"
          >
            {/* Multi-layer Secondary Overlay Video Track Runway Lanes (Hiển thị các tầng Layer ở hàng trên) */}
            {uniqueLayers.map((layerIdx) => {
              const layerItems = overlayScenes.filter(
                (item) => item.layerIndex === layerIdx,
              );
              return (
                <TrackLane
                  key={`overlay-layer-${layerIdx}`}
                  variant="secondary"
                  dataTrackType="overlay"
                  dataLayerIndex={layerIdx}
                  ghostPreview={
                    !isOverlayInsertLine && targetOverlayLayer === layerIdx
                      ? dragGhostState
                      : null
                  }
                  labelWidth={TIMELINE_LABEL_WIDTH}
                  canvasWidth={canvasWidth}
                  leftControl={
                    <button
                      type="button"
                      className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer text-[11px] font-mono font-semibold"
                      title={`Frame phụ (Layer ${layerIdx + 1})`}
                    >
                      L{layerIdx + 1}
                    </button>
                  }
                >
                  {layerItems.map((item) => (
                    <div
                      key={item.id}
                      className="absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm overflow-hidden"
                      style={{
                        left: item.startTime * pixelsPerSecond,
                        width: Math.max(item.duration * pixelsPerSecond, 24),
                      }}
                    >
                      <span className="truncate">
                        {item.name} ({item.duration}s)
                      </span>
                    </div>
                  ))}
                </TrackLane>
              );
            })}

            {/* Gray insert ghost (separate from cyan) — left synced via rAF */}
            {isOverlayInsertLine && dragGhostState && (
              <>
                <div
                  ref={insertGhostRef}
                  className="absolute z-30 h-8 -translate-y-1/2 flex items-center rounded bg-[#38383e] border border-[#4a4a52] px-2 text-[10px] font-semibold text-white/80 shadow-md pointer-events-none overflow-hidden will-change-[left]"
                  style={{
                    top: indicatorTopPos,
                    width: dragGhostState.width,
                  }}
                >
                  <span className="truncate">
                    {dragGhostState.label} ({dragGhostState.duration}s)
                  </span>
                </div>
                <div
                  className="absolute z-40 h-px bg-[#14B8A6] pointer-events-none"
                  style={{
                    top: indicatorTopPos,
                    left: TIMELINE_LABEL_WIDTH,
                    width: Math.max(canvasWidth, trackViewWidth),
                  }}
                />
              </>
            )}

            {/* 1. Main Video Track Runway Lane */}
            <TrackLane
              variant="main"
              dataTrackType="main"
              ghostPreview={
                !isOverlayInsertLine &&
                targetOverlayLayer === null &&
                dragGhostState?.targetTrack === "video"
                  ? dragGhostState
                  : null
              }
              labelWidth={TIMELINE_LABEL_WIDTH}
              canvasWidth={canvasWidth}
              leftControl={
                <>
                  <button
                    type="button"
                    className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                    title="Khung hình / Video"
                  >
                    <Film size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoLocked(!videoLocked)}
                    className={`p-1 transition-colors rounded cursor-pointer ${
                      videoLocked
                        ? "text-[var(--accent)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                    }`}
                    title={
                      videoLocked ? "Mở khóa Track Video" : "Khóa Track Video"
                    }
                  >
                    {videoLocked ? (
                      <Lock size={14} strokeWidth={1.75} />
                    ) : (
                      <Unlock size={14} strokeWidth={1.75} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoVisible(!videoVisible)}
                    className={`p-1 transition-colors rounded cursor-pointer ${
                      !videoVisible
                        ? "text-[var(--accent)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                    }`}
                    title={videoVisible ? "Ẩn Track Video" : "Hiện Track Video"}
                  >
                    {videoVisible ? (
                      <Eye size={14} strokeWidth={1.75} />
                    ) : (
                      <EyeOff size={14} strokeWidth={1.75} />
                    )}
                  </button>
                </>
              }
            >
              {sceneBlocks.map(({ scene, index, left, width, startTime }) => {
                const active = selectedSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    className={`absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] transition-all flex flex-col justify-center ${
                      active
                        ? "bg-[var(--timeline-clip-frame-hover)] text-white shadow-md"
                        : "bg-[var(--timeline-clip-frame)] text-white/90 hover:bg-[var(--timeline-clip-frame-hover)]"
                    }`}
                    style={{ left, width }}
                    onClick={() => {
                      selectScene(scene.id);
                      setCurrentTime(startTime);
                    }}
                  >
                    <span className="block truncate font-semibold text-white">
                      {index + 1}.{" "}
                      {scene.semantic?.role ?? scene.name ?? scene.id}
                    </span>
                    <span className="block truncate text-white/80">
                      {scene.duration}s
                    </span>
                  </button>
                );
              })}
            </TrackLane>

            {/* 2. Audio Track Runway Lane */}
            {audioTracks.length > 0 && (
              <TrackLane
                variant="secondary"
                ghostPreview={
                  dragGhostState?.targetTrack === "audio"
                    ? dragGhostState
                    : null
                }
                labelWidth={TIMELINE_LABEL_WIDTH}
                canvasWidth={canvasWidth}
                leftControl={
                  <>
                    <button
                      type="button"
                      className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors rounded cursor-pointer"
                      title="Nhạc / Âm thanh"
                    >
                      <Music size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioLocked(!audioLocked)}
                      className={`p-1 transition-colors rounded cursor-pointer ${
                        audioLocked
                          ? "text-[var(--accent)]"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                      }`}
                      title={
                        audioLocked ? "Mở khóa Track Audio" : "Khóa Track Audio"
                      }
                    >
                      {audioLocked ? (
                        <Lock size={14} strokeWidth={1.75} />
                      ) : (
                        <Unlock size={14} strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioMuted(!audioMuted)}
                      className={`p-1 transition-colors rounded cursor-pointer ${
                        audioMuted
                          ? "text-[var(--accent)]"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                      }`}
                      title={
                        audioMuted ? "Bật âm thanh Track" : "Tắt âm thanh Track"
                      }
                    >
                      {audioMuted ? (
                        <VolumeX size={14} strokeWidth={1.75} />
                      ) : (
                        <Volume2 size={14} strokeWidth={1.75} />
                      )}
                    </button>
                  </>
                }
              >
                {audioTracks.map((track) => (
                  <div
                    key={track.id}
                    className="absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[var(--timeline-clip-audio)] hover:bg-[var(--timeline-clip-audio-hover)] px-2 text-[10px] font-medium text-white shadow-sm transition-colors"
                    style={{
                      left: 0,
                      width: Math.max(
                        120,
                        Math.max(total, 1) * pixelsPerSecond,
                      ),
                    }}
                  >
                    🎵 {track.role}
                  </div>
                ))}
              </TrackLane>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
