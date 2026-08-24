"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import {
  projectLayersToTimeline,
  v2SelectionClips,
  v2SelectedClipIds,
} from "@motionvideo/editor-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransportBar } from "./Header/TransportBar";
import { ClipStrip } from "./clips/ClipStrip";
import { TimeRuler } from "./TimeRuler/TimeRuler";
import { TimelineHScrollBar } from "./viewport/TimelineHScrollBar";
import {
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_START_GUTTER_PX,
  TIMELINE_ZOOM_DEFAULT,
} from "./timeline-scale";
import { Playhead } from "./viewport/Playhead";

const LANE_HEIGHT = 32;
const LANE_GAP = 4;
const TIMELINE_END_SPACER_PX = 56;

/** Existing timeline chrome, projected directly from MotionProtocolV2. */
export function TimelineShell() {
  const {
    document,
    currentTime,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedLayerIds,
    setSelectedLayerIds,
  } = useEditorSurface();
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewWidth, setViewWidth] = useState(800);
  const [viewHeight, setViewHeight] = useState(320);
  const viewportRef = useRef<HTMLDivElement>(null);

  const projection = useMemo(
    () => projectLayersToTimeline(document),
    [document],
  );
  const fps = document.composition.fps;
  const duration = Math.max(projection.duration, 0.001);
  const pixelsPerSecond = Math.max(24, 52 + zoom * 2.4);
  const naturalTimelineWidth =
    TIMELINE_START_GUTTER_PX + duration * pixelsPerSecond + 160;
  const needsHorizontalScroll = naturalTimelineWidth > viewWidth;
  const timelineWidth = Math.max(viewWidth, naturalTimelineWidth);
  const contentWidth = needsHorizontalScroll
    ? timelineWidth + TIMELINE_END_SPACER_PX
    : timelineWidth;
  const clipsByLane = useMemo(() => {
    const map = new Map<string, typeof projection.clips>();
    for (const clip of projection.clips) {
      const clips = map.get(clip.laneId) ?? [];
      clips.push(clip);
      map.set(clip.laneId, clips);
    }
    return map;
  }, [projection.clips]);
  const selection = useMemo(
    () => v2SelectionClips(selectedLayerIds),
    [selectedLayerIds],
  );
  const selectedClipIds = useMemo(
    () => new Set(v2SelectedClipIds(selection)),
    [selection],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const updateSize = () => {
      setViewWidth(element.clientWidth || 800);
      setViewHeight(element.clientHeight || 320);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      setCurrentTime((time) => {
        const next = time + elapsed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying, setCurrentTime, setIsPlaying]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const element = viewportRef.current;
      if (!element) return;
      const relative =
        clientX - element.getBoundingClientRect().left + element.scrollLeft;
      const seconds = (relative - TIMELINE_START_GUTTER_PX) / pixelsPerSecond;
      setCurrentTime(Math.max(0, Math.min(duration, seconds)));
    },
    [duration, pixelsPerSecond, setCurrentTime],
  );
  const onHScrollLeft = useCallback((left: number) => {
    const element = viewportRef.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollLeft = Math.min(maxScroll, Math.max(0, left));
  }, []);
  const playheadLeft =
    TIMELINE_START_GUTTER_PX + currentTime * pixelsPerSecond - scrollLeft;
  const laneStackHeight = projection.lanes.length * (LANE_HEIGHT + LANE_GAP);
  const laneViewportHeight = Math.max(
    laneStackHeight + 48,
    viewHeight - TIMELINE_RULER_HEIGHT_PX,
  );
  const laneTopPadding =
    projection.lanes.length === 1
      ? Math.max(0, (laneViewportHeight - laneStackHeight) / 2)
      : 0;

  return (
    <section
      className="editor-panel flex h-full min-h-0 flex-col overflow-hidden [grid-area:timeline]"
      data-testid="editor-timeline"
      data-timeline-source="motion-protocol-v2"
    >
      <TransportBar
        mode="track"
        onModeChange={() => undefined}
        currentTime={currentTime}
        duration={duration}
        fps={fps}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((playing) => !playing)}
        zoom={zoom}
        onZoomChange={setZoom}
        snapOn={snapOn}
        onToggleSnap={() => setSnapOn((value) => !value)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-surface)]">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={viewportRef}
            className="relative h-full overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          >
            <div className="relative" style={{ width: contentWidth }}>
              <div className="sticky top-0 z-20 bg-[var(--bg-surface)]">
                <TimeRuler
                  duration={duration}
                  fps={fps}
                  pixelsPerSecond={pixelsPerSecond}
                  scrollLeft={scrollLeft}
                  originOffsetPx={TIMELINE_START_GUTTER_PX}
                  viewWidth={viewWidth}
                  onSeekClick={seekFromClientX}
                />
              </div>
              <div
                className="relative"
                style={{
                  minHeight: laneViewportHeight,
                }}
              >
                <div
                  style={{
                    marginLeft: TIMELINE_START_GUTTER_PX,
                    paddingTop: laneTopPadding,
                  }}
                >
                  {projection.lanes.map((lane) => (
                    <div
                      key={lane.id}
                      className="relative bg-[var(--timeline-track-lane)]"
                      style={{ height: LANE_HEIGHT, marginBottom: LANE_GAP }}
                      data-lane-id={lane.id}
                      data-track-role={lane.role}
                    >
                      {clipsByLane.get(lane.id)?.map((clip) => (
                        <ClipStrip
                          key={clip.id}
                          clip={clip}
                          visualKind={
                            lane.kind === "audio"
                              ? "audio"
                              : lane.role === "overlay"
                                ? "overlay"
                                : "main"
                          }
                          pixelsPerSecond={pixelsPerSecond}
                          selected={selectedClipIds.has(clip.id)}
                          showTrimHandles={selectedClipIds.has(clip.id)}
                          onBeginTrim={() => undefined}
                          onSelectPointerDown={() =>
                            setSelectedLayerIds([clip.id])
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {needsHorizontalScroll ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute top-0 right-0 h-px"
                    style={{ width: TIMELINE_END_SPACER_PX }}
                    data-testid="timeline-scroll-end-spacer"
                  />
                ) : null}
              </div>
            </div>
          </div>
          <Playhead
            leftPx={playheadLeft}
            muted={duration <= 0}
            onScrubStart={seekFromClientX}
            onScrubMove={seekFromClientX}
          />
        </div>
        <TimelineHScrollBar
          scrollLeft={scrollLeft}
          contentWidth={contentWidth}
          viewportWidth={viewWidth}
          onScrollLeft={onHScrollLeft}
        />
      </div>
    </section>
  );
}
