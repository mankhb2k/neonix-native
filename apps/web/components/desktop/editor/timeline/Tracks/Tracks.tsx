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

export function Tracks({ zoom }: Props) {
  const project = useEditorStore((s) => s.project);
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
  const rootRef = useRef<HTMLDivElement>(null);
  const rulerHeaderRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const insertGhostRef = useRef<HTMLDivElement>(null);
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
  }, [project]);

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

  if (!project) {
    return <div ref={rootRef} className="relative flex-1 overflow-auto" />;
  }

  const fps = project.metadata.fps ?? 30;
  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);
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
  const playheadLeft = TIMELINE_LABEL_WIDTH;
  const isEmpty = project.scenes.length === 0;

  let cursor = 0;
  const sceneBlocks = project.scenes.map((scene, index) => {
    const left = cursor * pixelsPerSecond;
    const width = Math.max(scene.duration * pixelsPerSecond, 8);
    cursor += scene.duration;
    return { scene, index, left, width };
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
    setDragOver(true);

    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const scrollLeft = rootRef.current.scrollLeft;
    const mouseX =
      event.clientX - rect.left + scrollLeft - TIMELINE_LABEL_WIDTH;
    const hoverTime = Math.max(0, mouseX / Math.max(pixelsPerSecond, 1));
    const left = hoverTime * pixelsPerSecond;

    // Single threshold vs TimeRuler top border: same line for card↔cyan.
    const rulerTop =
      rulerHeaderRef.current?.getBoundingClientRect().top ?? rect.top;
    const currentlyOver = useEditorStore.getState().isOverTimeline;
    const nextOver = event.clientY >= rulerTop + CYAN_MODE_BELOW_RULER_TOP_PX;
    if (nextOver !== currentlyOver) {
      setIsOverTimeline(nextOver);
    }

    // Above threshold as card mode: no lane ghosts (prevents flash under ruler).
    if (!nextOver) {
      if (event.clientX > 0 && event.clientY > 0) {
        setDragCursor(event.clientX, event.clientY);
      }
      setIsOverlayInsertLine(false);
      setTargetOverlayLayer(null);
      setDragGhostState(null);
      return;
    }

    const types = Array.from(event.dataTransfer.types);
    const isAudio =
      dragItem?.type === "audio" || types.includes(AUDIO_LIBRARY_MIME);
    const duration = dragItem?.duration ?? 5;
    const label =
      dragItem?.name ?? (isAudio ? "Âm thanh" : "Khung hình");
    const ghostWidth = Math.max(duration * pixelsPerSecond, 24);

    // Same rAF as cyan — gray left/width stay in lockstep.
    setDragGhostLayout(left, ghostWidth);
    // Cyan centered on gray (gray left ≈ clientX, center ≈ clientX + width/2).
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX + ghostWidth / 2, event.clientY);
    }

    if (!isAudio) {
      const ws = workspaceRef.current;

      function findNearestVideoLane(clientY: number): HTMLElement | null {
        const scope = ws ?? rootRef.current;
        if (!scope) return null;
        const lanes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
        let best: HTMLElement | null = null;
        let bestDist = Infinity;
        for (const lane of lanes) {
          const type = lane.getAttribute("data-track-type");
          if (type !== "overlay" && type !== "main") continue;
          const r = lane.getBoundingClientRect();
          let dist = 0;
          if (clientY < r.top) dist = r.top - clientY;
          else if (clientY > r.bottom) dist = clientY - r.bottom;
          if (dist < bestDist) {
            bestDist = dist;
            best = lane;
          }
        }
        return best;
      }

      function gapMidInWorkspace(
        edge: "above" | "below",
        layerIdx: number,
      ): number {
        const wsRect = ws!.getBoundingClientRect();
        const overlayLanes = Array.from(
          ws!.querySelectorAll<HTMLElement>(
            '[data-track-lane][data-track-type="overlay"]',
          ),
        );
        const thisLane = overlayLanes.find(
          (lane) => lane.getAttribute("data-layer-index") === String(layerIdx),
        );
        if (!thisLane) return 0;
        const thisRect = thisLane.getBoundingClientRect();

        if (edge === "above") {
          let aboveBottom = -Infinity;
          let foundAbove = false;
          for (const lane of overlayLanes) {
            const r = lane.getBoundingClientRect();
            if (r.bottom <= thisRect.top + 1 && r.bottom > aboveBottom) {
              aboveBottom = r.bottom;
              foundAbove = true;
            }
          }
          if (foundAbove) {
            // One shared Y for "below upper lane" and "above this lane"
            return (aboveBottom + thisRect.top) / 2 - wsRect.top;
          }
          return thisRect.top - wsRect.top - 1;
        }

        let belowTop = Infinity;
        let foundBelow = false;
        for (const lane of overlayLanes) {
          const r = lane.getBoundingClientRect();
          if (r.top >= thisRect.bottom - 1 && r.top < belowTop) {
            belowTop = r.top;
            foundBelow = true;
          }
        }
        if (foundBelow) {
          return (thisRect.bottom + belowTop) / 2 - wsRect.top;
        }
        const main = ws!.querySelector<HTMLElement>(
          '[data-track-lane][data-track-type="main"]',
        );
        if (main) {
          const mainRect = main.getBoundingClientRect();
          if (mainRect.top >= thisRect.bottom - 1) {
            return (thisRect.bottom + mainRect.top) / 2 - wsRect.top;
          }
        }
        return thisRect.bottom - wsRect.top - 1;
      }

      function applyLaneEdgeTarget(
        laneEl: HTMLElement,
        wasInsert: boolean,
      ): void {
        if (!ws) return;
        const laneRect = laneEl.getBoundingClientRect();
        const relY = event.clientY - laneRect.top;
        const h = laneRect.height;
        const trackType = laneEl.getAttribute("data-track-type");
        const layerIdxAttr = laneEl.getAttribute("data-layer-index");
        const wsRect = ws.getBoundingClientRect();
        const laneTopInWorkspace = laneRect.top - wsRect.top;

        const inBodyClear =
          relY > OVERLAY_EDGE_EXIT_PX && relY < h - OVERLAY_EDGE_EXIT_PX;
        const nearTopEnter = relY <= OVERLAY_EDGE_ENTER_PX;
        const nearBottomEnter = relY >= h - OVERLAY_EDGE_ENTER_PX;

        if (trackType === "overlay" && layerIdxAttr !== null) {
          const currentLayerIdx = parseInt(layerIdxAttr, 10);

          const setInsertAbove = () => {
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(currentLayerIdx + 1);
            setIndicatorTopPos(gapMidInWorkspace("above", currentLayerIdx));
          };
          const setInsertBelow = () => {
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(currentLayerIdx);
            setIndicatorTopPos(gapMidInWorkspace("below", currentLayerIdx));
          };
          const setBody = () => {
            setIsOverlayInsertLine(false);
            setTargetOverlayLayer(currentLayerIdx);
          };

          if (!wasInsert) {
            if (nearTopEnter) setInsertAbove();
            else if (nearBottomEnter) setInsertBelow();
            else setBody();
          } else if (inBodyClear) {
            setBody();
          } else if (relY < h / 2) {
            setInsertAbove();
          } else {
            setInsertBelow();
          }
          return;
        }

        if (trackType === "main") {
          if (!wasInsert) {
            if (nearTopEnter) {
              setIsOverlayInsertLine(true);
              setTargetOverlayLayer(0);
              // Midpoint between lowest overlay and main, or flush above main
              const overlayLanes = Array.from(
                ws.querySelectorAll<HTMLElement>(
                  '[data-track-lane][data-track-type="overlay"]',
                ),
              );
              let lowestBottom = -Infinity;
              for (const lane of overlayLanes) {
                const bottom = lane.getBoundingClientRect().bottom;
                if (bottom > lowestBottom) lowestBottom = bottom;
              }
              if (lowestBottom > -Infinity && lowestBottom <= laneRect.top + 1) {
                setIndicatorTopPos(
                  (lowestBottom + laneRect.top) / 2 - wsRect.top,
                );
              } else {
                setIndicatorTopPos(laneTopInWorkspace - 1);
              }
            } else {
              setIsOverlayInsertLine(false);
              setTargetOverlayLayer(null);
            }
          } else if (relY > OVERLAY_EDGE_EXIT_PX) {
            setIsOverlayInsertLine(false);
            setTargetOverlayLayer(null);
          } else {
            setIsOverlayInsertLine(true);
            setTargetOverlayLayer(0);
            setIndicatorTopPos(laneTopInWorkspace - 1);
          }
        }
      }

      const elementAtPoint = document.elementFromPoint(
        event.clientX,
        event.clientY,
      );
      let laneEl =
        (elementAtPoint?.closest("[data-track-lane]") as HTMLElement | null) ??
        null;

      // Ignore audio / unlabeled lanes for frame drop targeting
      if (
        laneEl &&
        laneEl.getAttribute("data-track-type") !== "overlay" &&
        laneEl.getAttribute("data-track-type") !== "main"
      ) {
        laneEl = null;
      }

      if (!laneEl && ws) {
        // Truly above the topmost overlay lane → insert new top layer
        const overlayLanes = ws.querySelectorAll<HTMLElement>(
          '[data-track-lane][data-track-type="overlay"]',
        );
        let topmost: HTMLElement | null = null;
        let topmostTop = Infinity;
        for (const lane of overlayLanes) {
          const top = lane.getBoundingClientRect().top;
          if (top < topmostTop) {
            topmostTop = top;
            topmost = lane;
          }
        }

        if (topmost && event.clientY < topmostTop) {
          const wsRect = ws.getBoundingClientRect();
          const maxLayer =
            uniqueLayers.length > 0 ? Math.max(...uniqueLayers) : 0;
          setIsOverlayInsertLine(true);
          setTargetOverlayLayer(maxLayer + 1);
          setIndicatorTopPos(topmostTop - wsRect.top - 1);
        } else {
          laneEl = findNearestVideoLane(event.clientY);
          if (laneEl) {
            applyLaneEdgeTarget(laneEl, isOverlayInsertLine);
          }
          // No lane at all: keep previous target (do not jump to L1)
        }
      } else if (laneEl) {
        applyLaneEdgeTarget(laneEl, isOverlayInsertLine);
      }
    } else {
      setIsOverlayInsertLine(false);
      setTargetOverlayLayer(null);
    }

    setDragGhostState({
      left,
      width: ghostWidth,
      label,
      duration,
      targetTrack: isAudio ? "audio" : "video",
    });
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

    setDragOver(false);
    setIsOverlayInsertLine(false);
    setTargetOverlayLayer(null);
    setDragGhostState(null);
    setIsOverTimeline(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    setIsOverTimeline(false);
    setActiveDragItem(null);
    clearDragCursor();

    if (isOverlayInsertLine || targetOverlayLayer !== null) {
      const frameId =
        event.dataTransfer.getData(FRAME_LIBRARY_MIME) ||
        event.dataTransfer.getData("text/plain");
      if (frameId && project) {
        const draft = getFrame(project.metadata.id, frameId);
        if (draft) {
          const dropTime = dragGhostState
            ? dragGhostState.left / Math.max(pixelsPerSecond, 1)
            : 0;
          addOverlaySceneFromFrame(
            draft,
            dropTime,
            targetOverlayLayer ?? 0,
            isOverlayInsertLine,
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
    if (!frameId || !project) return;
    const draft = getFrame(project.metadata.id, frameId);
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
            0
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
              {sceneBlocks.map(({ scene, index, left, width }) => {
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
                    onClick={() => selectScene(scene.id)}
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
            {project.timeline.audioTracks.length > 0 && (
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
                {project.timeline.audioTracks.map((track) => (
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
