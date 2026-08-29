"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type MutableRefObject,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { usePointerSessionHost } from "@/hooks/editor/pointer/use-pointer-session-host";
import { useTimelineMarquee } from "@/hooks/editor/timeline/use-timeline-marquee";
import { useTimelineSeek } from "@/hooks/editor/timeline/use-timeline-seek";
import { useTimelineViewportMetrics } from "@/hooks/editor/timeline/use-timeline-viewport-metrics";
import {
  clientXToTimelineTime,
  ensurePlayheadScrubScroll,
} from "@/lib/editor/interaction-host/timeline-dom";
import { registerTimelineLibraryDropHost } from "@/lib/editor/library/timeline-library-drop";
import { createScrubCoordinator } from "@/lib/editor/playback/scrub-coordinator";
import { updateKeyboardSelection } from "@/lib/editor/selection/keyboard-selection";
import { buildLaneHeightPrefix } from "@/lib/editor/timeline/lane-height-prefix";
import {
  selectedClipIdsFrom,
  selectionClips,
  sliderValueToZoomScale,
  computeViewportLayout,
  type EditorSelection,
  type TimelineClip,
  type TimelineEdit,
  type TimelineLane,
  computePlayheadFollowScroll,
  resolvePlayheadScrubMax,
  timelineTimeToViewportLeft,
  PLAYHEAD_SCRUB_EDGE_PX,
  PLAYHEAD_SCRUB_STEP_PX,
  PLAYHEAD_FOLLOW_MARGIN_PX,
  type ClipMovePreview,
  type MarqueeRect,
} from "@motionvideo/editor-core/timeline";
import {
  buildLayerLaneRows,
  buildTrackLaneRows,
  timelineVerticalInsets,
  visibleTrackLaneRows,
} from "../lanes/timeline-lane-rows";
import {
  LANE_GAP_PX,
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
import type { PlaybackTimeEventV3 as PlaybackTimeEvent } from "@/lib/editor/playback/playback-controller-v3";

type Props = {
  mode: TimelineDesignMode;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  duration: number;
  fps: number;
  zoom: number;
  /** Stable Fit anchor; only changes on project open or explicit Fit. */
  timelineFitAnchorSeconds: number | null;
  /** Reset horizontal scroll after an explicit Fit action. */
  fitRevision: number;
  registerPlaybackTimeSink: (sink: (event: PlaybackTimeEvent) => void) => () => void;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onSeek: (time: number) => void;
  /** Visual-only seek used while dragging the playhead (never schedules audio). */
  onScrubSeek?: (time: number) => void;
  onExecute: (command: TimelineEdit, label: string) => void;
  onToggleAudioTrackMuted?: (trackId: string) => void;
  onToggleVideoMuted?: (layerId: string) => void;
  onDetachVideoAudio?: (layerId: string) => void;
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
  duration,
  fps,
  zoom,
  timelineFitAnchorSeconds,
  fitRevision,
  registerPlaybackTimeSink,
  selection,
  onSelect,
  onSeek,
  onScrubSeek,
  onExecute,
  onToggleAudioTrackMuted,
  onToggleVideoMuted,
  onDetachVideoAudio,
  onBeginScrub,
  onEndScrub,
  onClipDoubleClick,
  exclusiveRows = false,
  autoSnapping = true,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const draggingPlayheadRef = useRef(false);
  const ppsRef = useRef(1);
  const scrubMaxRef = useRef(0);

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

  const layout = useMemo(
    () =>
      computeViewportLayout({
        clips,
        trackViewWidth: Math.max(1, viewWidth - TIMELINE_START_GUTTER_PX),
        timelineZoomScale: sliderValueToZoomScale(zoom),
        timelineFitAnchorSeconds,
      }),
    [clips, timelineFitAnchorSeconds, viewWidth, zoom],
  );

  const pps = layout.pixelsPerSecond;
  const rows = useMemo(() => {
    const built =
      mode === "layer"
        ? buildLayerLaneRows(lanes, clips)
        : buildTrackLaneRows(lanes, clips);
    return mode === "layer" ? built : visibleTrackLaneRows(built, clips);
  }, [clips, lanes, mode]);

  const verticalInsets = useMemo(
    () => timelineVerticalInsets(rows, tracksViewportHeight),
    [rows, tracksViewportHeight],
  );
  const scrollContentHeight =
    TIMELINE_RULER_HEIGHT_PX + verticalInsets.contentHeight;

  const { laneHeightPrefix, laneContentHeights, sortedLanes, clipsByLaneMap } =
    useMemo(() => {
      const contentHeights = rows.map((r) => r.height);
      const heightsWithGap = rows.map(
        (r, i) => r.height + (i < rows.length - 1 ? LANE_GAP_PX : 0),
      );
      const map = new Map<string, TimelineClip[]>();
      for (const clip of clips) {
        const list = map.get(clip.laneId);
        if (list) list.push(clip);
        else map.set(clip.laneId, [clip]);
      }
      for (const [, list] of map) {
        list.sort((a, b) => a.startTime - b.startTime);
      }
      return {
        laneContentHeights: contentHeights,
        laneHeightPrefix: buildLaneHeightPrefix(heightsWithGap),
        sortedLanes: rows,
        clipsByLaneMap: map,
      };
    }, [rows, clips]);

  /** Scroll Y includes ruler; marquee lane math starts below it. */
  const marqueeTopPadding = TIMELINE_RULER_HEIGHT_PX + verticalInsets.top;

  const trackWidth = layout.canvasWidth;
  const contentWidth = Math.max(
    viewWidth,
    TIMELINE_START_GUTTER_PX + trackWidth,
  );
  const surfaceDuration = Math.max(duration, layout.extentSeconds);
  // Keep every seek entry point (ruler click, empty-track click and marquee)
  // on the same bound as playhead dragging. The surface can be wider than the
  // playable clock when its layout extent is larger than the longest layer.
  const scrubMax = resolvePlayheadScrubMax(surfaceDuration, duration);

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
    onSeek,
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

  const onClipSelectPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip) => {
      const selected = selectedClipIdsFrom(selection);
      const orderedClipIds = rows
        .flatMap((row) => clipsByLaneMap.get(row.id) ?? [])
        .map((candidate) => candidate.id);
      const next = updateKeyboardSelection(orderedClipIds, selected, clip.id, {
        shiftKey: event.shiftKey,
        additiveKey: event.metaKey || event.ctrlKey,
      });
      onSelect(selectionClips(next));
    },
    [clipsByLaneMap, onSelect, rows, selection],
  );

  ppsRef.current = pps;
  scrubMaxRef.current = scrubMax;

  const scrollPlayheadAtEdge = useCallback((clientX: number): boolean => {
      const scroll = scrollRef.current;
      if (!scroll) return false;
      const { scrolledBy } = ensurePlayheadScrubScroll(
        scroll,
        clientX,
        ppsRef.current,
        scrubMaxRef.current,
        PLAYHEAD_SCRUB_EDGE_PX,
        PLAYHEAD_SCRUB_STEP_PX,
      );
      // The scroll event updates the viewport metrics asynchronously. A
      // subsequent coordinator flush reads the new scrollLeft and computes
      // the corresponding composition time.
      return scrolledBy !== 0;
    },
    [],
  );

  const flushPlayheadScrub = useCallback(
    (clientX: number, reason: "begin" | "frame" | "end") => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      if (reason !== "frame") scrollPlayheadAtEdge(clientX);
      const time = clientXToTimelineTime(
        clientX,
        scroll,
        ppsRef.current,
        scrubMaxRef.current,
      );
      (onScrubSeek ?? onSeek)(time);
    },
    [onScrubSeek, onSeek, scrollPlayheadAtEdge],
  );

  const scrubCoordinator = useMemo(
    () => createScrubCoordinator({
      onBegin: () => {
        draggingPlayheadRef.current = true;
        onBeginScrub?.();
      },
      onFlush: flushPlayheadScrub,
      onEdgeFrame: scrollPlayheadAtEdge,
      onEnd: () => {
        draggingPlayheadRef.current = false;
        onEndScrub?.();
      },
    }),
    [flushPlayheadScrub, onBeginScrub, onEndScrub, scrollPlayheadAtEdge],
  );

  useEffect(() => () => {
    scrubCoordinator.cancel();
    draggingPlayheadRef.current = false;
  }, [scrubCoordinator]);

  const onPlayheadScrubStart = useCallback(
    (clientX: number) => scrubCoordinator.begin(clientX),
    [scrubCoordinator],
  );

  const onPlayheadScrubMove = useCallback(
    (clientX: number) => scrubCoordinator.move(clientX),
    [scrubCoordinator],
  );

  const onPlayheadScrubEnd = useCallback(
    () => scrubCoordinator.end(),
    [scrubCoordinator],
  );

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
                duration={surfaceDuration}
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
                muteWindow={null}
                duration={surfaceDuration}
                selection={selection}
                beginGesture={beginGesture}
                onSelect={onSelect}
                onExecute={onExecute}
                onToggleAudioTrackMuted={onToggleAudioTrackMuted}
                onToggleVideoMuted={onToggleVideoMuted}
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
                  disabled={!contextMenu.clip.embeddedAudio || !onDetachVideoAudio}
                  onClick={() => {
                    if (contextMenu.clip.kind === "scene") onDetachVideoAudio?.(contextMenu.clip.sceneId);
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
          <TimelinePlayheadLayer
            registerPlaybackTimeSink={registerPlaybackTimeSink}
            pps={pps}
            scrollRef={scrollRef}
            draggingRef={draggingPlayheadRef}
            surfaceDuration={surfaceDuration}
            timelineEmpty={timelineEmpty}
            onHScrollLeft={onHScrollLeft}
            muted={timelineEmpty || surfaceDuration <= 0}
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

type TimelinePlayheadLayerProps = {
  registerPlaybackTimeSink: (sink: (event: PlaybackTimeEvent) => void) => () => void;
  pps: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  draggingRef: MutableRefObject<boolean>;
  surfaceDuration: number;
  timelineEmpty: boolean;
  onHScrollLeft: (next: number) => void;
  muted: boolean;
  onScrubStart: (clientX: number) => void;
  onScrubMove: (clientX: number) => void;
  onScrubEnd: () => void;
};

function TimelinePlayheadLayer({
  registerPlaybackTimeSink,
  pps,
  scrollRef,
  draggingRef,
  surfaceDuration,
  timelineEmpty,
  onHScrollLeft,
  muted,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
}: TimelinePlayheadLayerProps) {
  const positionRef = useRef<HTMLDivElement>(null);
  const ppsRef = useRef(pps);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const followRafRef = useRef<number | null>(null);
  ppsRef.current = pps;

  useEffect(() => {
    const updatePosition = (time: number) => {
      const root = positionRef.current;
      if (!root) return;
      const left = timelineTimeToViewportLeft(
        time,
        TIMELINE_START_GUTTER_PX,
        ppsRef.current,
        scrollRef.current?.scrollLeft ?? 0,
      );
      root.style.left = `${left}px`;
      root.dataset.playheadTime = String(time);
    };
    const follow = () => {
      followRafRef.current = null;
      if (!playingRef.current || draggingRef.current) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const { scrollLeftDelta, nextScrollLeft } = computePlayheadFollowScroll({
        time: timeRef.current,
        tracksOriginX: TIMELINE_START_GUTTER_PX,
        pixelsPerSecond: ppsRef.current,
        scrollLeft: scroll.scrollLeft,
        clientWidth: scroll.clientWidth,
        scrollWidth: scroll.scrollWidth,
        marginPx: PLAYHEAD_FOLLOW_MARGIN_PX,
      });
      if (scrollLeftDelta !== 0) onHScrollLeft(nextScrollLeft);
    };
    const release = registerPlaybackTimeSink(({ time, playing }: PlaybackTimeEvent) => {
      timeRef.current = time;
      playingRef.current = playing;
      updatePosition(time);
      if (playing && !draggingRef.current && followRafRef.current == null) {
        followRafRef.current = requestAnimationFrame(follow);
      }
    });
    return () => {
      release();
      if (followRafRef.current != null) cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    };
  }, [draggingRef, onHScrollLeft, registerPlaybackTimeSink, scrollRef]);

  return (
    <Playhead
      leftPx={0}
      positionRef={positionRef}
      muted={muted || timelineEmpty || surfaceDuration <= 0}
      onScrubStart={onScrubStart}
      onScrubMove={onScrubMove}
      onScrubEnd={onScrubEnd}
    />
  );
}
