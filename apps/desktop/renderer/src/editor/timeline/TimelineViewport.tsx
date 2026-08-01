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
import { ClipStrip, type ClipMovePreview } from "./ClipStrip";
import {
  autoScrollTimelineNearEdge,
  resolveDropGeometryAtPoint,
  setTimelineDropHost,
  type TimelineDropHost,
  type ValidatedDropGeometry,
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
import { TimelineContextMenu } from "./TimelineContextMenu";
import { TimeRuler } from "./TimeRuler";
import { useVisibleTimeline } from "./use-visible-timeline";
import { computeViewportLayout } from "./viewport-layout";
import "./timeline-layout.css";

const MARQUEE_THRESHOLD_PX = 3;

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
  canPaste?: boolean;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
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
  canPaste,
  onSelect,
  onExecute,
  onCopy,
  onCut,
  onPaste,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [dropGhost, setDropGhost] = useState<ValidatedDropGeometry | null>(
    null,
  );
  const [clipMovePreview, setClipMovePreview] =
    useState<ClipMovePreview | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const clock = usePlaybackClockApi();
  const { beginGesture } = usePointerSessionHost();

  const scrollLeftRafRef = useRef<number | null>(null);
  const scrollTopRafRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);
  const pendingScrollTopRef = useRef(0);
  const dropGhostRafRef = useRef<number | null>(null);
  const pendingDropGhostRef = useRef<ValidatedDropGeometry | null | undefined>(
    undefined,
  );

  const flushDropGhost = useCallback(() => {
    dropGhostRafRef.current = null;
    if (pendingDropGhostRef.current === undefined) return;
    const next = pendingDropGhostRef.current;
    pendingDropGhostRef.current = undefined;
    setDropGhost(next);
  }, []);

  const scheduleDropGhost = useCallback(
    (next: ValidatedDropGeometry | null) => {
      pendingDropGhostRef.current = next;
      if (dropGhostRafRef.current == null) {
        dropGhostRafRef.current = requestAnimationFrame(flushDropGhost);
      }
    },
    [flushDropGhost],
  );

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

  useEffect(() => {
    return () => {
      if (dropGhostRafRef.current != null) {
        cancelAnimationFrame(dropGhostRafRef.current);
        dropGhostRafRef.current = null;
      }
    };
  }, []);

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

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
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
        scheduleDropGhost(null);
        return;
      }
      const geo = resolveDropGeometryAtPoint(
        session.clientX,
        session.clientY,
        session.item,
      );
      scheduleDropGhost(geo);
    });
  }, [scheduleDropGhost]);

  const beginMarquee = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;
      const rect = scroll.getBoundingClientRect();
      const origin = {
        x: event.clientX - rect.left + scroll.scrollLeft,
        y: event.clientY - rect.top + scroll.scrollTop,
      };
      const existingIds = selectedClipIdsFrom(selection);
      let shiftHeld = event.shiftKey;

      const onShiftKey = (ev: KeyboardEvent) => {
        if (ev.key === "Shift") {
          shiftHeld = ev.type === "keydown" || ev.shiftKey;
        }
      };

      type MarqueeState = { box: MarqueeRect; moved: boolean };

      beginGesture<MarqueeState, void>(
        {
          name: "marquee",
          onStart: () => {
            window.addEventListener("keydown", onShiftKey);
            window.addEventListener("keyup", onShiftKey);
            const box = normalizeMarquee(origin, origin);
            setMarquee(box);
            return { box, moved: false };
          },
          onUpdate: (pos) => {
            autoScrollTimelineNearEdge(pos.x, pos.y);
            const r = scroll.getBoundingClientRect();
            const next = {
              x: pos.x - r.left + scroll.scrollLeft,
              y: pos.y - r.top + scroll.scrollTop,
            };
            const box = normalizeMarquee(origin, next);
            const moved =
              Math.hypot(next.x - origin.x, next.y - origin.y) >=
              MARQUEE_THRESHOLD_PX;
            setMarquee(box);
            return { box, moved };
          },
          onCommit: (state) => {
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);
            if (!state.moved) return;

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
            const hits = clipIdsInMarquee(state.box, hitBoxes);
            if (shiftHeld) {
              onSelect(
                selectionClips([...new Set([...existingIds, ...hits])]),
              );
            } else {
              onSelect(selectionClips(hits));
            }
          },
          onCancel: () => {
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);
          },
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.pointerId,
      );
    },
    [
      beginGesture,
      clipsByLaneMap,
      disabled,
      layout.pixelsPerSecond,
      onSelect,
      selection,
      sortedLanes,
    ],
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

        <TimelineContextMenu
          className="timeline-board__tracks-ctx"
          selection={selection}
          disabled={disabled}
          canPaste={canPaste}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          onExecute={onExecute}
          getPlayheadTime={getPlayheadTime}
        >
          <div
            ref={tracksScrollRef}
            className="timeline-board__tracks"
            data-timeline-drop-zone="true"
            data-pixels-per-second={layout.pixelsPerSecond}
            onScroll={onScroll}
            onPointerDown={(event) => {
              if (disabled || event.button !== 0) return;
              if ((event.target as HTMLElement).closest("[data-clip-id]"))
                return;
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
                        movePreview={clipMovePreview}
                        onMovePreviewChange={setClipMovePreview}
                        beginGesture={beginGesture}
                        onSelect={onSelect}
                        onExecute={onExecute}
                      />
                    </div>
                  );
                })}
                {dropGhost ? (
                  <div
                    className={
                      dropGhost.valid
                        ? "timeline-board__drop-ghost"
                        : "timeline-board__drop-ghost timeline-board__drop-ghost--invalid"
                    }
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
        </TimelineContextMenu>
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
