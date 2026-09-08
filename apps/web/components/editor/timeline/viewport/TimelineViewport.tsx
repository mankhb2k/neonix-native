"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { usePointerSessionHost } from "@/hooks/editor/pointer/use-pointer-session-host";
import { useTimelineClipSelection } from "@/hooks/editor/timeline/use-timeline-clip-selection";
import { useTimelineMarquee } from "@/hooks/editor/timeline/use-timeline-marquee";
import { useTimelinePlayheadFollow } from "@/hooks/editor/timeline/use-timeline-playhead-follow";
import { useTimelinePlayheadScrub } from "@/hooks/editor/timeline/use-timeline-playhead-scrub";
import { useTimelineSeek } from "@/hooks/editor/timeline/use-timeline-seek";
import { useTimelineViewportLayout } from "@/hooks/editor/timeline/use-timeline-viewport-layout";
import { useTimelineViewportMetrics } from "@/hooks/editor/timeline/use-timeline-viewport-metrics";
import { registerTimelineLibraryDropHost } from "@/lib/editor/library/timeline-library-drop";
import {
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineAction,
  type TimelineClip,
  type TimelineEdit,
  type TimelineLane,
  type ClipMovePreview,
  type MarqueeRect,
} from "@motionvideo/editor-core/timeline";
import {
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_START_GUTTER_PX,
} from "../timeline-scale";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { ClipMoveOverlays } from "./ClipMoveOverlays";
import { LibraryDropGhostOverlay } from "./LibraryDropGhostOverlay";
import { Playhead } from "./Playhead";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import type { TimelineDesignMode } from "../Header/TransportBar";
import type { TimelinePlaybackPort } from "@/lib/editor/timeline/timeline-playback-port";

type Props = {
  mode: TimelineDesignMode;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  playback: TimelinePlaybackPort;
  fps: number;
  zoom: number;
  /** Stable Fit anchor; only changes on project open or explicit Fit. */
  timelineFitAnchorSeconds: number | null;
  /** Reset horizontal scroll after an explicit Fit action. */
  fitRevision: number;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineEdit, label: string) => void;
  onAction?: (action: TimelineAction) => void;
  onBeginScrub?: () => void;
  onEndScrub?: () => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
  /** AE/V2 mode: one root layer occupies one visual row. */
  exclusiveRows?: boolean;
  /** Enables edge/playhead snapping while dragging clips. */
  autoSnapping?: boolean;
};

export const TimelineViewport = memo(function TimelineViewport({
  mode,
  clips,
  lanes,
  playback,
  fps,
  zoom,
  timelineFitAnchorSeconds,
  fitRevision,
  selection,
  onSelect,
  onExecute,
  onAction,
  onBeginScrub,
  onEndScrub,
  onClipDoubleClick,
  exclusiveRows = false,
  autoSnapping = true,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [marqueeSelectionIds, setMarqueeSelectionIds] = useState<
    string[] | null
  >(null);
  const [movePreview, setMovePreview] = useState<ClipMovePreview | null>(null);
  const [viewportClientLeft, setViewportClientLeft] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    clip: TimelineClip;
    x: number;
    y: number;
  } | null>(null);

  const {
    viewWidth: rawViewWidth,
    trackViewHeight,
    scrollLeft,
    onScroll,
    onHScrollLeft,
  } = useTimelineViewportMetrics({
    boardRef: scrollRef,
    tracksScrollRef: scrollRef,
    resetKey: fitRevision,
    contentMeasureKey: 0,
  });
  const layoutReady = rawViewWidth > 0 && trackViewHeight > 0;
  const viewWidth = Math.max(1, rawViewWidth);
  const tracksViewportHeight = Math.max(
    0,
    trackViewHeight - TIMELINE_RULER_HEIGHT_PX,
  );
  const timelineEmpty = clips.length === 0 && mode === "track";

  const { beginGesture } = usePointerSessionHost();

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  const onClipContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, clip: TimelineClip) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ clip, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const duration = Math.max(playback.duration, 0.001);
  const {
    pps,
    rows,
    verticalInsets,
    scrollContentHeight,
    laneHeightPrefix,
    laneContentHeights,
    sortedLanes,
    clipsByLaneMap,
    marqueeTopPadding,
    trackWidth,
    contentWidth,
    canvasDuration,
    scrubMax,
  } = useTimelineViewportLayout({
    mode,
    clips,
    lanes,
    viewWidth,
    tracksViewportHeight,
    zoom,
    timelineFitAnchorSeconds,
    duration,
  });

  const selectedClipIds = useMemo(
    () => new Set(selectedClipIdsFrom(selection)),
    [selection],
  );
  const previewSelectedIds = useMemo(
    () => (marqueeSelectionIds ? new Set(marqueeSelectionIds) : null),
    [marqueeSelectionIds],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setViewportClientLeft(el.getBoundingClientRect().left);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !layoutReady) return undefined;
    return registerTimelineLibraryDropHost({
      scrollEl,
      pixelsPerSecond: pps,
      lanes: rows,
      clips,
      clipsByLane: clipsByLaneMap,
      tracksOriginX: TIMELINE_START_GUTTER_PX,
      laneHitLayout: {
        topPadding: TIMELINE_RULER_HEIGHT_PX + verticalInsets.top,
        laneHeightPrefix,
        laneContentHeights,
      },
    });
  }, [
    pps,
    rows,
    clips,
    clipsByLaneMap,
    verticalInsets.top,
    laneHeightPrefix,
    laneContentHeights,
    layoutReady,
  ]);

  const seekToClientX = useTimelineSeek({
    tracksScrollRef: scrollRef,
    pixelsPerSecond: pps,
    maxTime: scrubMax,
    onSeek: playback.previewSeek,
  });

  const onSeekClick = useCallback(
    (clientX: number) => {
      seekToClientX(clientX);
    },
    [seekToClientX],
  );

  const beginMarquee = useTimelineMarquee({
    tracksScrollRef: scrollRef,
    disabled: clips.length === 0 && rows.length === 0,
    selection,
    beginGesture,
    laneHeightPrefix,
    laneContentHeights,
    topPadding: marqueeTopPadding,
    sortedLanes,
    clipsByLaneMap,
    pixelsPerSecond: pps,
    onSelect,
    seekToClientX,
    onMarqueeRect: setMarqueeRect,
    onMarqueeSelectionIds: setMarqueeSelectionIds,
  });

  const onClipSelectPointerDown = useTimelineClipSelection({
    selection,
    rows,
    clipsByLaneMap,
    onSelect,
  });
  const {
    draggingRef: draggingPlayheadRef,
    onScrubStart: onPlayheadScrubStart,
    onScrubMove: onPlayheadScrubMove,
    onScrubEnd: onPlayheadScrubEnd,
  } = useTimelinePlayheadScrub({
    playback,
    scrollRef,
    pixelsPerSecond: pps,
    scrubMax,
    onBeginScrub,
    onEndScrub,
  });
  const playheadPositionRef = useRef<HTMLDivElement>(null);
  useTimelinePlayheadFollow({
    playback,
    pixelsPerSecond: pps,
    scrollRef,
    draggingRef: draggingPlayheadRef,
    onHScrollLeft,
    positionRef: playheadPositionRef,
  });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[var(--bg-surface)]"
      data-testid="timeline-viewport"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="relative h-full min-h-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-timeline-drop-zone="true"
          onScroll={onScroll}
        >
          {layoutReady ? (
            <div
              className="relative"
              style={{ width: contentWidth, height: scrollContentHeight }}
            >
            <div className="sticky top-0 z-20 bg-[var(--bg-surface)]">
              <TimeRuler
                duration={canvasDuration}
                fps={fps}
                pixelsPerSecond={pps}
                scrollLeft={scrollLeft}
                originOffsetPx={TIMELINE_START_GUTTER_PX}
                viewWidth={viewWidth}
                onSeekClick={onSeekClick}
              />
            </div>
            <div
              className="relative"
              style={{ height: verticalInsets.contentHeight }}
            >
              <TimelineTrackCanvas
                rows={rows}
                clipsByLane={clipsByLaneMap}
                allClips={clips}
                lanes={lanes}
                pixelsPerSecond={pps}
                scrollLeft={scrollLeft}
                viewWidth={viewWidth}
                contentWidth={trackWidth}
                topPadding={verticalInsets.top}
                bottomPadding={verticalInsets.bottom}
                selectedClipIds={selectedClipIds}
                previewSelectedIds={previewSelectedIds}
                selection={selection}
                beginGesture={beginGesture}
                onSelect={onSelect}
                onExecute={onExecute}
                onAction={onAction}
                scrollRef={scrollRef}
                onMarqueePointerDown={beginMarquee}
                onClipSelectPointerDown={onClipSelectPointerDown}
                onClipDoubleClick={onClipDoubleClick}
                onClipContextMenu={onClipContextMenu}
                exclusiveRows={exclusiveRows || mode === "layer"}
                autoSnapping={autoSnapping}
                timelineEmpty={timelineEmpty}
                movePreview={movePreview}
                onMovePreview={setMovePreview}
              />
            </div>

            {marqueeRect ? (
              <div
                className="pointer-events-none absolute z-40 border border-[var(--accent)] bg-[var(--accent-soft)]"
                style={{
                  left: marqueeRect.left,
                  top: marqueeRect.top,
                  width: Math.max(1, marqueeRect.right - marqueeRect.left),
                  height: Math.max(1, marqueeRect.bottom - marqueeRect.top),
                }}
                data-testid="timeline-marquee"
              />
            ) : null}

            <ClipMoveOverlays
              preview={movePreview}
              pixelsPerSecond={pps}
              contentWidth={contentWidth}
              contentHeight={scrollContentHeight}
              viewportClientLeft={viewportClientLeft}
              scrollLeft={scrollLeft}
            />

              <LibraryDropGhostOverlay contentWidth={contentWidth} />
            </div>
          ) : null}
        </div>
        {contextMenu ? (
          <div
            className="fixed z-[80] min-w-44 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-1 text-[11px] shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            data-testid="timeline-clip-context-menu"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className="truncate px-3 py-1 text-[10px] text-[var(--fg-muted)]">{contextMenu.clip.name}</p>
            {contextMenu.clip.kind === "scene" && contextMenu.clip.mediaType === "video" ? (
              <>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!contextMenu.clip.embeddedAudio || !onAction}
                  onClick={() => {
                    if (contextMenu.clip.kind === "scene") {
                      onAction?.({
                        type: "detach-video-audio",
                        targetId: contextMenu.clip.sceneId,
                      });
                    }
                    setContextMenu(null);
                  }}
                >
                  Detach audio
                </button>
                <button type="button" disabled className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-[var(--fg-muted)] opacity-40" title="An imported audio derivative is required">
                  Extract audio
                </button>
                <button type="button" disabled className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-[var(--fg-muted)] opacity-40">
                  Replace audio
                </button>
                <button type="button" disabled className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-[var(--fg-muted)] opacity-40">
                  Restore linked audio
                </button>
              </>
            ) : (
              <p className="px-3 py-1.5 text-[var(--fg-muted)]">No linked audio actions</p>
            )}
          </div>
        ) : null}
        {layoutReady ? (
          <Playhead
            leftPx={0}
            positionRef={playheadPositionRef}
            muted={timelineEmpty || canvasDuration <= 0}
            onScrubStart={onPlayheadScrubStart}
            onScrubMove={onPlayheadScrubMove}
            onScrubEnd={onPlayheadScrubEnd}
          />
        ) : null}
      </div>

      <TimelineHScrollBar
        scrollLeft={scrollLeft}
        contentWidth={contentWidth}
        viewportWidth={viewWidth}
        onScrollLeft={onHScrollLeft}
      />
    </div>
  );
});
