"use client";

import {
  buildLaneHeightPrefix,
  usePointerSessionHost,
  useTimelineMarquee,
  useTimelineSeek,
  useTimelineViewportMetrics,
} from "@motionvideo/editor-react";
import {
  selectedClipIdsFrom,
  selectionClips,
  sliderValueToZoomScale,
  computeViewportLayout,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  computePlayheadFollowScroll,
  ensurePlayheadScrubScroll,
  resolvePlayheadScrubMax,
  timelineTimeToContentLeft,
  PLAYHEAD_SCRUB_EDGE_PX,
  PLAYHEAD_SCRUB_STEP_PX,
  PLAYHEAD_FOLLOW_MARGIN_PX,
  type MarqueeRect,
} from "@motionvideo/editor-interactions";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import type { TimelineDesignMode } from "../Header/TransportBar";
import { Playhead } from "./Playhead";
import { LibraryDropGhostOverlay } from "./LibraryDropGhostOverlay";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import { registerTimelineLibraryDropHost } from "@/lib/editor/library/timeline-library-drop";

type Props = {
  mode: TimelineDesignMode;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  duration: number;
  fps: number;
  zoom: number;
  currentTime: number;
  isPlaying?: boolean;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onSeek: (time: number) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onBeginScrub?: () => void;
  onEndScrub?: () => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
};

export function TimelineViewport({
  mode,
  clips,
  lanes,
  duration,
  fps,
  zoom,
  currentTime,
  isPlaying = false,
  selection,
  onSelect,
  onSeek,
  onExecute,
  onBeginScrub,
  onEndScrub,
  onClipDoubleClick,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tracksAreaRef = useRef<HTMLDivElement>(null);
  const draggingPlayheadRef = useRef(false);
  const lastScrubClientXRef = useRef(0);
  const playheadEdgeRafRef = useRef<number | null>(null);
  const ppsRef = useRef(1);
  const scrubMaxRef = useRef(0);

  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [marqueeSelectionIds, setMarqueeSelectionIds] = useState<
    string[] | null
  >(null);

  const {
    viewWidth: rawViewWidth,
    trackViewHeight,
    scrollLeft,
    onScroll,
    onHScrollLeft,
  } = useTimelineViewportMetrics({
    boardRef: scrollRef,
    tracksScrollRef: scrollRef,
    trackAreaRef: tracksAreaRef,
    resetKey: 0,
    contentMeasureKey: 0,
  });
  const viewWidth = rawViewWidth || 800;
  const timelineEmpty = clips.length === 0 && mode === "track";

  const { beginGesture } = usePointerSessionHost();

  const layout = useMemo(
    () =>
      computeViewportLayout({
        clips,
        trackViewWidth: Math.max(1, viewWidth - TIMELINE_START_GUTTER_PX),
        timelineZoomScale: sliderValueToZoomScale(zoom),
      }),
    [clips, viewWidth, zoom],
  );

  const pps = layout.pixelsPerSecond;
  const rows = useMemo(() => {
    const built =
      mode === "layer" ? buildLayerLaneRows(lanes) : buildTrackLaneRows(lanes);
    return mode === "layer" ? built : visibleTrackLaneRows(built, clips);
  }, [clips, lanes, mode]);

  const verticalInsets = useMemo(
    () => timelineVerticalInsets(rows, trackViewHeight),
    [rows, trackViewHeight],
  );

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
        sortedLanes: rows as TimelineLane[],
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

  const selectedClipIds = useMemo(
    () => new Set(selectedClipIdsFrom(selection)),
    [selection],
  );
  const previewSelectedIds = useMemo(
    () => (marqueeSelectionIds ? new Set(marqueeSelectionIds) : null),
    [marqueeSelectionIds],
  );

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    return registerTimelineLibraryDropHost({
      scrollEl,
      pixelsPerSecond: pps,
      lanes: rows,
      clips,
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
    verticalInsets.top,
    laneHeightPrefix,
    laneContentHeights,
  ]);

  const seekToClientX = useTimelineSeek({
    tracksScrollRef: scrollRef,
    pixelsPerSecond: pps,
    maxTime: surfaceDuration,
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
      const additive = event.metaKey || event.ctrlKey;
      const already = selected.includes(clip.id);
      if (additive) {
        const next = already
          ? selected.filter((id) => id !== clip.id)
          : [...selected, clip.id];
        onSelect(selectionClips(next));
        return;
      }
      if (!already) onSelect(selectionClips([clip.id]));
    },
    [onSelect, selection],
  );

  const playheadLeft = timelineTimeToContentLeft(
    currentTime,
    TIMELINE_START_GUTTER_PX,
    pps,
  );

  ppsRef.current = pps;
  scrubMaxRef.current = resolvePlayheadScrubMax(surfaceDuration, duration);

  /** During playback, scroll the board so the playhead stays in view. */
  useEffect(() => {
    if (!isPlaying || draggingPlayheadRef.current) return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const { scrollLeftDelta, nextScrollLeft } = computePlayheadFollowScroll({
      time: currentTime,
      tracksOriginX: TIMELINE_START_GUTTER_PX,
      pixelsPerSecond: pps,
      scrollLeft: scroll.scrollLeft,
      clientWidth: scroll.clientWidth,
      scrollWidth: scroll.scrollWidth,
      marginPx: PLAYHEAD_FOLLOW_MARGIN_PX,
    });
    if (scrollLeftDelta === 0) return;
    onHScrollLeft(nextScrollLeft);
  }, [currentTime, isPlaying, pps, onHScrollLeft]);

  const stopPlayheadEdgeLoop = useCallback(() => {
    if (playheadEdgeRafRef.current != null) {
      cancelAnimationFrame(playheadEdgeRafRef.current);
      playheadEdgeRafRef.current = null;
    }
  }, []);

  const scrubPlayheadFromClientX = useCallback(
    (clientX: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      lastScrubClientXRef.current = clientX;
      const { time, scrolledBy } = ensurePlayheadScrubScroll(
        scroll,
        clientX,
        ppsRef.current,
        scrubMaxRef.current,
        PLAYHEAD_SCRUB_EDGE_PX,
        PLAYHEAD_SCRUB_STEP_PX,
      );
      // scroll position updated by onScroll handler via browser event
      void scrolledBy;
      onSeek(time);
    },
    [onSeek],
  );

  const ensurePlayheadEdgeLoop = useCallback(() => {
    if (playheadEdgeRafRef.current != null) return;
    const tick = () => {
      playheadEdgeRafRef.current = null;
      if (!draggingPlayheadRef.current) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const clientX = lastScrubClientXRef.current;
      const rect = scroll.getBoundingClientRect();
      const nearRight = clientX > rect.right - PLAYHEAD_SCRUB_EDGE_PX;
      const nearLeft = clientX < rect.left + PLAYHEAD_SCRUB_EDGE_PX;
      if (!nearRight && !nearLeft) return;
      const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      const canRight = nearRight && scroll.scrollLeft < maxScroll;
      const canLeft = nearLeft && scroll.scrollLeft > 0;
      if (!canRight && !canLeft) return;
      scrubPlayheadFromClientX(clientX);
      playheadEdgeRafRef.current = requestAnimationFrame(tick);
    };
    playheadEdgeRafRef.current = requestAnimationFrame(tick);
  }, [scrubPlayheadFromClientX]);

  useEffect(() => {
    return () => {
      stopPlayheadEdgeLoop();
      draggingPlayheadRef.current = false;
    };
  }, [stopPlayheadEdgeLoop]);

  const onPlayheadScrubStart = useCallback(
    (clientX: number) => {
      draggingPlayheadRef.current = true;
      onBeginScrub?.();
      scrubPlayheadFromClientX(clientX);
      ensurePlayheadEdgeLoop();
    },
    [ensurePlayheadEdgeLoop, onBeginScrub, scrubPlayheadFromClientX],
  );

  const onPlayheadScrubMove = useCallback(
    (clientX: number) => {
      if (!draggingPlayheadRef.current) return;
      scrubPlayheadFromClientX(clientX);
      ensurePlayheadEdgeLoop();
    },
    [ensurePlayheadEdgeLoop, scrubPlayheadFromClientX],
  );

  const onPlayheadScrubEnd = useCallback(() => {
    draggingPlayheadRef.current = false;
    stopPlayheadEdgeLoop();
    onEndScrub?.();
  }, [onEndScrub, stopPlayheadEdgeLoop]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[var(--bg-surface)]"
      data-testid="timeline-viewport"
    >
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-timeline-drop-zone="true"
        onScroll={onScroll}
      >
        <div
          className="relative flex h-full min-h-0 flex-col"
          style={{ width: contentWidth }}
        >
          <TimeRuler
            duration={surfaceDuration}
            fps={fps}
            pixelsPerSecond={pps}
            scrollLeft={scrollLeft}
            originOffsetPx={TIMELINE_START_GUTTER_PX}
            viewWidth={viewWidth}
            onSeekClick={onSeekClick}
          />
          <div ref={tracksAreaRef} className="relative min-h-0 flex-1">
            <div style={{ marginLeft: TIMELINE_START_GUTTER_PX }}>
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
                scrollRef={scrollRef}
                onMarqueePointerDown={beginMarquee}
                onClipSelectPointerDown={onClipSelectPointerDown}
                onClipDoubleClick={onClipDoubleClick}
                timelineEmpty={timelineEmpty}
              />
            </div>
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

          <LibraryDropGhostOverlay contentWidth={contentWidth} />

          <Playhead
            leftPx={playheadLeft}
            muted={timelineEmpty || surfaceDuration <= 0}
            onScrubStart={onPlayheadScrubStart}
            onScrubMove={onPlayheadScrubMove}
            onScrubEnd={onPlayheadScrubEnd}
          />
        </div>
      </div>

      <TimelineHScrollBar
        scrollLeft={scrollLeft}
        contentWidth={contentWidth}
        viewportWidth={viewWidth}
        onScrollLeft={onHScrollLeft}
      />
    </div>
  );
}
