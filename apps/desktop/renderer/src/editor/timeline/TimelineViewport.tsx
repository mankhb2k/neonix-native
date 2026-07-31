import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { subscribe as subscribeLibraryDrag } from "../library/interactions/library-drag-session";
import { usePlaybackClockApi } from "../playback/playback-clock-store";
import { ClipStrip } from "./ClipStrip";
import {
  resolveDropGeometryAtPoint,
  setTimelineDropHost,
  type TimelineDropHost,
} from "./drop-host";
import { usePointerSessionHost } from "./interactions/use-pointer-session";
import {
  clipIdsInMarquee,
  normalizeMarquee,
  type MarqueeRect,
} from "./marquee-geometry";
import { Playhead } from "./Playhead";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
  laneRowHeightPx,
} from "./timeline-scale";
import { clientXToTimelineTime } from "./timeline-seek";
import { TimeRuler } from "./TimeRuler";
import { useVisibleTimeline } from "./use-visible-timeline";
import { computeViewportLayout } from "./viewport-layout";
import type { TimelineDropGeometry } from "./drop-geometry";
import "./timeline-layout.css";

type Props = {
  projectId: string | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  fps: number;
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
  selection: EditorSelection;
  disabled?: boolean;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
};

export function TimelineViewport({
  projectId,
  clips,
  lanes,
  fps,
  timelineZoomScale,
  timelineFitAnchorSeconds,
  timelineFitRevision,
  selection,
  disabled,
  onSelect,
  onExecute,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [dropGhost, setDropGhost] = useState<TimelineDropGeometry | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const clock = usePlaybackClockApi();
  const { beginGesture } = usePointerSessionHost();

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

  const pinIds = useMemo(
    () => new Set(selectedClipIdsFrom(selection)),
    [selection],
  );

  const { clipsForLane } = useVisibleTimeline({
    scrollLeft,
    viewWidth: trackViewWidth,
    pixelsPerSecond: layout.pixelsPerSecond,
    lanes: sortedLanes,
    clipsByLane: clipsByLaneMap,
    pinIds,
  });

  const totalLaneHeight = sortedLanes.reduce(
    (sum, lane) => sum + laneRowHeightPx(lane),
    0,
  );

  const seekToClientX = useCallback(
    (clientX: number) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;
      const time = clientXToTimelineTime(
        clientX,
        scroll,
        layout.pixelsPerSecond,
        layout.extentSeconds,
      );
      clock.getState().seek(time);
    },
    [clock, disabled, layout.extentSeconds, layout.pixelsPerSecond],
  );

  useLayoutEffect(() => {
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) {
      setTimelineDropHost(null);
      return undefined;
    }
    const next: TimelineDropHost = {
      scrollEl,
      lanes: sortedLanes,
      lanesTop: 0,
      laneHeight: 48,
      laneHeightFor: laneRowHeightPx,
      pixelsPerSecond: layout.pixelsPerSecond,
      tracksOriginX: TIMELINE_PLAYHEAD_GUTTER_PX,
    };
    setTimelineDropHost(next);
    return () => setTimelineDropHost(null);
  }, [sortedLanes, layout.pixelsPerSecond]);

  useEffect(() => {
    return subscribeLibraryDrag((session) => {
      if (session.phase !== "dragging") {
        setDropGhost(null);
        return;
      }
      setDropGhost(
        resolveDropGeometryAtPoint(session.clientX, session.clientY),
      );
    });
  }, []);

  const beginMarquee = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;
      const rect = scroll.getBoundingClientRect();
      const origin = {
        x: event.clientX - rect.left + scroll.scrollLeft,
        y: event.clientY - rect.top + scroll.scrollTop,
      };
      setMarquee(normalizeMarquee(origin, origin));

      const onMove = (ev: PointerEvent) => {
        const next = {
          x: ev.clientX - rect.left + scroll.scrollLeft,
          y: ev.clientY - rect.top + scroll.scrollTop,
        };
        setMarquee(normalizeMarquee(origin, next));
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const end = {
          x: ev.clientX - rect.left + scroll.scrollLeft,
          y: ev.clientY - rect.top + scroll.scrollTop,
        };
        const box = normalizeMarquee(origin, end);
        setMarquee(null);

        const hitBoxes: Array<{
          id: string;
          left: number;
          top: number;
          right: number;
          bottom: number;
        }> = [];
        let laneTop = 0;
        for (const lane of sortedLanes) {
          const h = laneRowHeightPx(lane);
          for (const clip of clipsByLaneMap.get(lane.id) ?? []) {
            const left =
              TIMELINE_PLAYHEAD_GUTTER_PX +
              clip.startTime * layout.pixelsPerSecond;
            const right = left + clip.duration * layout.pixelsPerSecond;
            hitBoxes.push({
              id: clip.id,
              left,
              top: laneTop,
              right,
              bottom: laneTop + h,
            });
          }
          laneTop += h;
        }
        onSelect(selectionClips(clipIdsInMarquee(box, hitBoxes)));
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clipsByLaneMap, disabled, layout.pixelsPerSecond, onSelect, sortedLanes],
  );

  void scrollTop;

  const ghostLaneTop = useMemo(() => {
    if (!dropGhost) return 0;
    let top = 0;
    for (const lane of sortedLanes) {
      if (lane.id === dropGhost.laneId) break;
      top += laneRowHeightPx(lane);
    }
    return top;
  }, [dropGhost, sortedLanes]);

  return (
    <div
      ref={boardRef}
      className="timeline-board"
      data-testid="timeline-viewport"
    >
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
              onSeekClick={disabled ? undefined : seekToClientX}
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
          data-timeline-drop-zone="true"
          data-pixels-per-second={layout.pixelsPerSecond}
          onScroll={onScroll}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return;
            if ((event.target as HTMLElement).closest("[data-clip-id]")) return;
            if (event.shiftKey) {
              beginMarquee(event);
              return;
            }
            onSelect(selectionNone());
            seekToClientX(event.clientX);
          }}
        >
          {sortedLanes.length === 0 ? (
            <p className="timeline-board__empty">No lanes in this project.</p>
          ) : (
            <div
              className="timeline-board__canvas"
              style={{
                width: Math.max(layout.canvasWidth, trackViewWidth),
                height: Math.max(totalLaneHeight, 1),
                paddingLeft: TIMELINE_PLAYHEAD_GUTTER_PX,
                position: "relative",
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
                      lane={lane}
                      pixelsPerSecond={layout.pixelsPerSecond}
                      laneHeight={h}
                      selection={selection}
                      disabled={disabled}
                      beginGesture={beginGesture}
                      onSelect={onSelect}
                      onExecute={onExecute}
                    />
                  </div>
                );
              })}
              {dropGhost ? (
                <div
                  className="timeline-board__drop-ghost"
                  aria-hidden
                  style={{
                    top: ghostLaneTop,
                    left: dropGhost.startTime * layout.pixelsPerSecond,
                    height: laneRowHeightPx(
                      sortedLanes.find((l) => l.id === dropGhost.laneId) ??
                        sortedLanes[0]!,
                    ),
                  }}
                >
                  <div className="timeline-board__insert-line" />
                </div>
              ) : null}
              {marquee ? (
                <div
                  className="timeline-board__marquee"
                  aria-hidden
                  style={{
                    left: marquee.left,
                    top: marquee.top,
                    width: marquee.right - marquee.left,
                    height: marquee.bottom - marquee.top,
                  }}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Playhead
        tracksOriginX={TIMELINE_TRACKS_ORIGIN_X}
        pixelsPerSecond={layout.pixelsPerSecond}
        scrollLeft={scrollLeft}
        scrollContainerRef={tracksScrollRef}
        maxTime={layout.extentSeconds}
        enabled={!disabled}
      />
    </div>
  );
}
