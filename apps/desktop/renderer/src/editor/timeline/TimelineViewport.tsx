import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import { ClipStrip } from "./ClipStrip";
import { TimeRuler } from "./TimeRuler";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
  laneRowHeightPx,
} from "./timeline-scale";
import { useVisibleTimeline } from "./use-visible-timeline";
import { computeViewportLayout } from "./viewport-layout";
import "./timeline-layout.css";

type Props = {
  projectId: string | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  fps: number;
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
};

export function TimelineViewport({
  projectId,
  clips,
  lanes,
  fps,
  timelineZoomScale,
  timelineFitAnchorSeconds,
  timelineFitRevision,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const scrollLeftRafRef = useRef<number | null>(null);
  const scrollTopRafRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);
  const pendingScrollTopRef = useRef(0);

  const onScroll = useCallback(() => {
    const root = tracksScrollRef.current;
    if (!root) return;
    pendingScrollLeftRef.current = root.scrollLeft;
    pendingScrollTopRef.current = root.scrollTop;

    if (scrollLeftRafRef.current == null) {
      scrollLeftRafRef.current = requestAnimationFrame(() => {
        scrollLeftRafRef.current = null;
        setScrollLeft(pendingScrollLeftRef.current);
      });
    }
    if (scrollTopRafRef.current == null) {
      scrollTopRafRef.current = requestAnimationFrame(() => {
        scrollTopRafRef.current = null;
        setScrollTop(pendingScrollTopRef.current);
      });
    }
  }, []);

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
    setScrollTop(0);
  }, [projectId, timelineFitRevision]);

  const trackViewWidth = Math.max(0, viewWidth - TIMELINE_TRACKS_ORIGIN_X);

  const layout = useMemo(
    () =>
      computeViewportLayout({
        clips,
        trackViewWidth,
        timelineZoomScale,
        timelineFitAnchorSeconds,
      }),
    [clips, trackViewWidth, timelineZoomScale, timelineFitAnchorSeconds],
  );

  const sortedLanes = useMemo(
    () =>
      [...lanes].sort((a, b) => {
        if (a.kind === "visual" && a.role === "base") return -1;
        if (b.kind === "visual" && b.role === "base") return 1;
        return a.order - b.order;
      }),
    [lanes],
  );

  const clipsByLaneMap = useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const lane of lanes) {
      map.set(lane.id, []);
    }
    for (const clip of clips) {
      if (!clip.laneId) continue;
      const list = map.get(clip.laneId);
      if (list) list.push(clip);
      else map.set(clip.laneId, [clip]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime - b.startTime);
    }
    return map;
  }, [clips, lanes]);

  const { clipsForLane } = useVisibleTimeline({
    scrollLeft,
    viewWidth: trackViewWidth,
    pixelsPerSecond: layout.pixelsPerSecond,
    lanes: sortedLanes,
    clipsByLane: clipsByLaneMap,
  });

  const totalLaneHeight = sortedLanes.reduce(
    (sum, lane) => sum + laneRowHeightPx(lane),
    0,
  );

  // scrollTop reserved for future vertical lane windowing
  void scrollTop;

  return (
    <div ref={boardRef} className="timeline-board" data-testid="timeline-viewport">
      <div className="timeline-board__ruler-row">
        <div
          className="timeline-board__corner"
          style={{ width: TIMELINE_LABEL_WIDTH }}
        />
        <div className="timeline-board__ruler-scroll">
          <div
            className="timeline-board__gutter"
            style={{ width: TIMELINE_PLAYHEAD_GUTTER_PX }}
            aria-hidden
          />
          <div
            className="timeline-board__ruler-pad"
            style={{ paddingLeft: TIMELINE_PLAYHEAD_GUTTER_PX }}
          >
            <TimeRuler
              duration={layout.extentSeconds}
              fps={fps}
              pixelsPerSecond={layout.pixelsPerSecond}
              viewWidth={trackViewWidth}
              scrollLeft={scrollLeft}
            />
          </div>
        </div>
      </div>

      <div className="timeline-board__body-row">
        <div
          className="timeline-board__labels"
          style={{ width: TIMELINE_LABEL_WIDTH }}
          onWheel={(e) => {
            if (tracksScrollRef.current) {
              tracksScrollRef.current.scrollTop += e.deltaY;
            }
          }}
        >
          <div style={{ transform: `translateY(${-scrollTop}px)` }}>
            {sortedLanes.map((lane) => (
              <div
                key={lane.id}
                className="timeline-board__label"
                style={{ height: laneRowHeightPx(lane) }}
                title={lane.name}
              >
                {lane.name}
              </div>
            ))}
          </div>
        </div>

        <div
          ref={tracksScrollRef}
          className="timeline-board__tracks"
          onScroll={onScroll}
        >
          {sortedLanes.length === 0 ? (
            <p className="timeline-board__empty">No lanes in this project.</p>
          ) : (
            <div
              className="timeline-board__canvas"
              style={{
                width: Math.max(layout.canvasWidth, trackViewWidth),
                height: Math.max(totalLaneHeight, 1),
              }}
            >
              {sortedLanes.map((lane) => {
                const h = laneRowHeightPx(lane);
                const visibleClips = clipsForLane(lane.id);
                return (
                  <div
                    key={lane.id}
                    className="timeline-board__lane-band"
                    style={{ height: h }}
                    data-lane-id={lane.id}
                  >
                    <ClipStrip
                      clips={visibleClips}
                      pixelsPerSecond={layout.pixelsPerSecond}
                      laneHeight={h}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
