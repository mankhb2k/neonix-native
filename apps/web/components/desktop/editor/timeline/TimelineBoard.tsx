"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { clipsContentEndSeconds } from "@/lib/editor/timeline-clips";
import {
  fitPixelsPerSecond,
  resolveFitAnchorSeconds,
  timelineExtentSeconds,
  timelineFitSpanSeconds,
} from "./timeline-fit";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "./timeline-scale";
import { TimeRuler } from "./TimeRuler/TimeRuler";
import { Playhead, clientXToTimelineTime } from "./Tracks/Playhead";
import { TimelineLaneLabels } from "./Tracks/TimelineLaneLabels";
import { Tracks } from "./Tracks/Tracks";

type Props = {
  zoom?: number;
};

/**
 * Board under TransportBar: fixed TimeRuler + scrollable Tracks + viewport playhead.
 * Does not subscribe to currentTime — playhead follows the playback clock imperatively.
 */
export function TimelineBoard({ zoom }: Props) {
  void zoom;
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const timelineLanes = useEditorStore((s) => s.timelineLanes);
  const timelineZoomScale = useEditorStore((s) => s.timelineZoomScale ?? 1.0);
  const timelineFitAnchorSeconds = useEditorStore(
    (s) => s.timelineFitAnchorSeconds,
  );
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const activeDragItem = useEditorStore((s) => s.activeDragItem);
  const seek = usePlaybackClock((s) => s.seek);

  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const rulerHeaderRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrubBlocked, setScrubBlocked] = useState(false);

  const timelineFitRevision = useEditorStore((s) => s.timelineFitRevision);
  const projectId = useEditorStore((s) => s.project?.metadata.id);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = tracksScrollRef.current;
    if (!root) return;
    root.scrollLeft = 0;
    root.scrollTop = 0;
    setScrollLeft(0);
  }, [projectId, timelineFitRevision]);

  const contentEnd = clipsContentEndSeconds(timelineClips);
  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_TRACKS_ORIGIN_X);

  const anchorSeconds =
    timelineFitAnchorSeconds ?? resolveFitAnchorSeconds(timelineClips);
  const fitSpan = timelineFitSpanSeconds(anchorSeconds);
  const fitPps = fitPixelsPerSecond(trackViewWidth, fitSpan);
  const pixelsPerSecond = fitPps * timelineZoomScale;

  const visibleDuration =
    trackViewWidth > 0 ? trackViewWidth / pixelsPerSecond : fitSpan;
  const isFirstClip = timelineClips.length <= 1;
  const extentSeconds = timelineExtentSeconds(
    contentEnd,
    fitSpan,
    visibleDuration,
    isFirstClip,
  );
  const rulerDuration = extentSeconds;
  const canvasWidth = Math.max(
    trackViewWidth,
    extentSeconds * pixelsPerSecond,
  );

  const [scrollTop, setScrollTop] = useState(0);

  const seekEnabled = !scrubBlocked && activeDragItem == null;

  const boardColumns = `${TIMELINE_LABEL_WIDTH}px ${TIMELINE_PLAYHEAD_GUTTER_PX}px minmax(0, 1fr)`;

  return (
    <div
      ref={boardRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]"
    >
      <Playhead
        tracksOriginX={TIMELINE_TRACKS_ORIGIN_X}
        pixelsPerSecond={pixelsPerSecond}
        scrollLeft={scrollLeft}
        scrollContainerRef={tracksScrollRef}
        enabled={seekEnabled}
      />

      <div
        ref={rulerHeaderRef}
        className="grid shrink-0 overflow-hidden bg-[var(--bg-panel)]"
        style={{ gridTemplateColumns: boardColumns }}
      >
        <div
          className="relative z-50 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]"
          style={{ height: 28 }}
        />
        {/* CapCut playhead gutter — t=0 handle sits here */}
        <div
          className="relative z-30 bg-[var(--bg)]"
          style={{ height: 28 }}
          aria-hidden
        />
        <div className="min-w-0 overflow-hidden">
          <TimeRuler
            duration={rulerDuration}
            fps={fps}
            pixelsPerSecond={pixelsPerSecond}
            viewWidth={trackViewWidth}
            scrollLeft={scrollLeft}
            onSeekClick={
              seekEnabled
                ? (clientX) => {
                    const root = tracksScrollRef.current;
                    if (!root) return;
                    seek(
                      clientXToTimelineTime(
                        clientX,
                        root,
                        TIMELINE_TRACKS_ORIGIN_X,
                        pixelsPerSecond,
                        contentEnd,
                      ),
                    );
                  }
                : undefined
            }
          />
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: boardColumns }}
      >
        <TimelineLaneLabels
          labelWidth={TIMELINE_LABEL_WIDTH}
          timelineLanes={timelineLanes}
          scrollTop={scrollTop}
          onWheel={(deltaY) => {
            if (tracksScrollRef.current) {
              tracksScrollRef.current.scrollTop += deltaY;
            }
          }}
        />
        <div className="min-h-0 bg-[var(--bg)]" aria-hidden />
        <Tracks
          scrollRef={tracksScrollRef}
          rulerHeaderRef={rulerHeaderRef}
          viewWidth={viewWidth}
          pixelsPerSecond={pixelsPerSecond}
          canvasWidth={canvasWidth}
          onScrollLeft={setScrollLeft}
          onScrollTop={setScrollTop}
          onScrubBlockedChange={setScrubBlocked}
        />
      </div>
    </div>
  );
}
