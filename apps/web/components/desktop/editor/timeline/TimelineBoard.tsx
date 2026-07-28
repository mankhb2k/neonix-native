"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { clipsContentEndSeconds } from "@/lib/timeline-clips";
import { TimeRuler } from "./TimeRuler/TimeRuler";
import { Tracks } from "./Tracks/Tracks";
import { Playhead, clientXToTimelineTime } from "./Tracks/Playhead";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PPS_MIN,
  maxPixelsPerSecondForView,
  timelineCanvasDuration,
  timelineWorkspaceSeconds,
  zoomToPixelsPerSecond,
} from "./timeline-scale";

type Props = {
  zoom: number;
};

/**
 * Board under TransportBar: fixed TimeRuler + scrollable Tracks + viewport playhead.
 * Vertical scroll only affects Tracks; horizontal scroll syncs ruler via translateX.
 */
export function TimelineBoard({ zoom }: Props) {
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const activeDragItem = useEditorStore((s) => s.activeDragItem);

  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const rulerHeaderRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrubBlocked, setScrubBlocked] = useState(false);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const contentEnd = clipsContentEndSeconds(timelineClips);
  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);
  const workspaceSeconds = timelineWorkspaceSeconds(contentEnd);
  const floorPps =
    trackViewWidth > 0 ? trackViewWidth / workspaceSeconds : TIMELINE_PPS_MIN;
  const ceilingPps = maxPixelsPerSecondForView(trackViewWidth, fps);
  const pixelsPerSecond = zoomToPixelsPerSecond(zoom, floorPps, ceilingPps);
  const rulerDuration = timelineCanvasDuration(
    contentEnd,
    pixelsPerSecond,
    trackViewWidth,
  );
  const canvasWidth = rulerDuration * pixelsPerSecond;

  /** Playhead X in board viewport (not content coordinates). */
  const playheadLeft =
    TIMELINE_LABEL_WIDTH + currentTime * pixelsPerSecond - scrollLeft;

  const seekEnabled = !scrubBlocked && activeDragItem == null;

  return (
    <div
      ref={boardRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]"
    >
      {/* Viewport-fixed playhead — not inside Tracks scroll */}
      <Playhead
        left={playheadLeft}
        labelWidth={TIMELINE_LABEL_WIDTH}
        pixelsPerSecond={pixelsPerSecond}
        maxTime={contentEnd}
        scrollContainerRef={tracksScrollRef}
        enabled={seekEnabled}
        onSeek={setCurrentTime}
      />

      {/* TimeRuler — fixed vertically; ticks scroll with tracks via translateX */}
      <div
        ref={rulerHeaderRef}
        className="z-30 flex shrink-0 overflow-hidden bg-[var(--bg-panel)]"
      >
        <div
          className="shrink-0 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]"
          style={{ width: TIMELINE_LABEL_WIDTH, height: 28 }}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="will-change-transform"
            style={{
              width: canvasWidth,
              transform: `translateX(${-scrollLeft}px)`,
            }}
          >
            <TimeRuler
              duration={rulerDuration}
              fps={fps}
              pixelsPerSecond={pixelsPerSecond}
              width={canvasWidth}
              onSeekClick={
                seekEnabled
                  ? (clientX) => {
                      const root = tracksScrollRef.current;
                      if (!root) return;
                      setCurrentTime(
                        clientXToTimelineTime(
                          clientX,
                          root,
                          TIMELINE_LABEL_WIDTH,
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
      </div>

      {/* Tracks only — vertical + horizontal scroll */}
      <Tracks
        zoom={zoom}
        scrollRef={tracksScrollRef}
        rulerHeaderRef={rulerHeaderRef}
        viewWidth={viewWidth}
        pixelsPerSecond={pixelsPerSecond}
        canvasWidth={canvasWidth}
        contentEnd={contentEnd}
        onScrollLeft={setScrollLeft}
        onScrubBlockedChange={setScrubBlocked}
      />
    </div>
  );
}
