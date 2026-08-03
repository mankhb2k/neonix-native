import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { subscribe as subscribeLibraryDrag } from "../../library/interactions/library-drag-session";
import { usePlaybackClockApi } from "../../playback/playback-clock-store";
import { ClipStrip } from "../clips/ClipStrip";
import { collectClipEdgeSnapPoints } from "../clips/clip-move-geometry";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import {
  registerTimelineDropHost,
  type TimelineDropHost,
} from "../drop/library-drop";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import {
  resetDropGhostScheduler,
  scheduleDropGhostSample,
  setMarquee,
  useMovePinKey,
} from "../interactions/timeline-preview-session";
import { usePointerSessionHost } from "../interactions/use-pointer-session";
import {
  clipIdsInMarquee,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  selectionIdsEqual,
  type MarqueeRect,
} from "../selection/marquee-geometry";
import { Playhead } from "./Playhead";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_TRACKS_ORIGIN_X,
  laneRowHeightPx,
} from "../timeline-scale";
import { clientXToTimelineTime } from "../timeline-seek";
import { TimelineContextMenu } from "../context-menu/TimelineContextMenu";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { useVisibleTimeline } from "../view-model/use-visible-timeline";
import { computeViewportLayout } from "./viewport-layout";
import {
  buildLaneHeightPrefix,
  visibleLaneWindow,
} from "../view-model/visible-lane-window";
import { LaneFlagControls } from "../lanes/LaneFlagControls";
import { buildLaneContentKindById } from "../lanes/lane-content-kind";
import { LaneLeadingIcon } from "../lanes/LaneLeadingIcon";
import { EmptyTimelineDash } from "./EmptyTimelineDash";
import { TimelineOverlays } from "./TimelineOverlays";
import { useTimelineViewportMetrics } from "./use-timeline-viewport-metrics";
import {
  buildTimelineLaneRows,
  LANE_GAP_PX,
  timelineVerticalInsets,
  type TimelineLaneRow,
} from "../lanes/timeline-lane-rows";
import type { MotionProject } from "@motionvideo/motion-schema";

/** DOM attrs for CapCut drop collectors (lane-drop-target). */
function laneDropDomAttrs(lane: TimelineLane): {
  "data-track-type": "main" | "overlay" | "audio";
  "data-track-role": "base" | "overlay" | "audio";
  "data-track-family": "visual" | "audio";
  "data-lane-order": number;
} {
  if (lane.kind === "audio") {
    return {
      "data-track-type": "audio",
      "data-track-role": "audio",
      "data-track-family": "audio",
      "data-lane-order": lane.order,
    };
  }
  if (lane.role === "base") {
    return {
      "data-track-type": "main",
      "data-track-role": "base",
      "data-track-family": "visual",
      "data-lane-order": lane.order,
    };
  }
  return {
    "data-track-type": "overlay",
    "data-track-role": "overlay",
    "data-track-family": "visual",
    "data-lane-order": lane.order,
  };
}

const MARQUEE_THRESHOLD_PX = 4;

type Props = {
  projectId: string | null;
  project?: MotionProject | null;
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
  project = null,
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
  const movePinKey = useMovePinKey();
  const clock = usePlaybackClockApi();
  const { beginGesture } = usePointerSessionHost();
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);

  const {
    viewWidth,
    trackViewHeight,
    scrollLeft,
    scrollTop,
    hScrollContentWidth,
    hScrollViewportWidth,
    onScroll,
    onHScrollLeft,
  } = useTimelineViewportMetrics({
    boardRef,
    tracksScrollRef,
    resetKey: `${projectId ?? ""}:${timelineFitRevision}`,
    contentMeasureKey: `${clips.length}:${lanes.length}:${timelineZoomScale}`,
  });

  useLayoutEffect(() => {
    resetDropGhostScheduler();
  }, [projectId, timelineFitRevision]);

  useEffect(() => {
    return () => {
      resetDropGhostScheduler();
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

  const laneRows = useMemo(() => buildTimelineLaneRows(lanes), [lanes]);
  const sortedLanes = useMemo(
    () => laneRows.map((row) => row.lane),
    [laneRows],
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

  const laneDropIndexes = useMemo(() => {
    const siblingLaneRefs = sortedLanes.map((lane) => ({
      id: lane.id,
      order: lane.order,
      role:
        lane.kind === "audio"
          ? ("audio" as const)
          : lane.role === "base"
            ? ("base" as const)
            : ("overlay" as const),
    }));
    const overlayLaneRefs = siblingLaneRefs
      .filter((l) => l.role === "overlay")
      .sort((a, b) => a.order - b.order);
    const audioLaneRefs = siblingLaneRefs
      .filter((l) => l.role === "audio")
      .sort((a, b) => a.order - b.order);
    return { siblingLaneRefs, overlayLaneRefs, audioLaneRefs };
  }, [sortedLanes]);

  const laneContentKindById = useMemo(
    () => buildLaneContentKindById(lanes, clips, project),
    [lanes, clips, project],
  );

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

  const verticalInsets = useMemo(
    () => timelineVerticalInsets(laneRows, trackViewHeight),
    [laneRows, trackViewHeight],
  );
  const topPadding = verticalInsets.top;
  const contentHeight = verticalInsets.contentHeight;

  const seekToClientX = useCallback(
    (clientX: number) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled || clips.length === 0) return;
      const time = clientXToTimelineTime(
        clientX,
        scroll,
        layout.pixelsPerSecond,
        layout.extentSeconds,
      );
      clock.getState().seek(time);
    },
    [clock, clips.length, disabled, layout.extentSeconds, layout.pixelsPerSecond],
  );

  const getPlayheadTime = useCallback(
    () => clock.getState().currentTime,
    [clock],
  );

  useLayoutEffect(() => {
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) return undefined;
    const next: TimelineDropHost = {
      scrollEl,
      lanes: sortedLanes,
      lanesTop: topPadding,
      laneHeight: 48,
      laneHeightFor: laneRowHeightPx,
      laneGapPx: LANE_GAP_PX,
      pixelsPerSecond: layout.pixelsPerSecond,
      tracksOriginX: TIMELINE_PLAYHEAD_GUTTER_PX,
      snapPoints: autoSnapping
        ? collectClipEdgeSnapPoints(clips, new Set())
        : [],
      snapThresholdSec: 8 / Math.max(1e-6, layout.pixelsPerSecond),
      clips,
      clipsByLane: clipsByLaneMap,
      siblingLaneRefs: laneDropIndexes.siblingLaneRefs,
      overlayLaneRefs: laneDropIndexes.overlayLaneRefs,
      audioLaneRefs: laneDropIndexes.audioLaneRefs,
    };
    return registerTimelineDropHost(next);
  }, [
    sortedLanes,
    layout.pixelsPerSecond,
    topPadding,
    clips,
    autoSnapping,
    clipsByLaneMap,
    laneDropIndexes,
  ]);

  useEffect(() => {
    return subscribeLibraryDrag((session) => {
      if (session.phase !== "dragging") {
        scheduleDropGhostSample({ kind: "clear" });
        return;
      }
      scheduleDropGhostSample({
        kind: "point",
        clientX: session.clientX,
        clientY: session.clientY,
        item: session.item,
      });
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
      const originClientX = event.clientX;
      const existingIds = selectedClipIdsFrom(selection);
      let shiftHeld = event.shiftKey;
      let hitBoxes: Array<{
        id: string;
        left: number;
        top: number;
        right: number;
        bottom: number;
      }> | null = null;
      let lastLiveIds: string[] = [];

      const onShiftKey = (ev: KeyboardEvent) => {
        if (ev.key === "Shift") {
          shiftHeld = ev.type === "keydown" || ev.shiftKey;
        }
      };

      const buildHitBoxes = () => {
        const boxes: NonNullable<typeof hitBoxes> = [];
        let laneTop = topPadding;
        for (let i = 0; i < sortedLanes.length; i += 1) {
          const lane = sortedLanes[i]!;
          const h = laneRowHeightPx(lane);
          for (const clip of clipsByLaneMap.get(lane.id) ?? []) {
            const left =
              TIMELINE_PLAYHEAD_GUTTER_PX +
              clip.startTime * layout.pixelsPerSecond;
            const right = left + clip.duration * layout.pixelsPerSecond;
            boxes.push({
              id: clip.id,
              left,
              top: laneTop,
              right,
              bottom: laneTop + h,
            });
          }
          laneTop += h;
          if (i < sortedLanes.length - 1) laneTop += LANE_GAP_PX;
        }
        return boxes;
      };

      const applyLiveSelection = (box: MarqueeRect) => {
        if (!hitBoxes) hitBoxes = buildHitBoxes();
        const hits = clipIdsInMarquee(box, hitBoxes);
        const next = resolveMarqueeSelectionIds(hits, existingIds, shiftHeld);
        if (selectionIdsEqual(next, lastLiveIds)) return;
        lastLiveIds = next;
        onSelect(selectionClips(next));
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
            if (moved) applyLiveSelection(box);
            return { box, moved };
          },
          onCommit: (state) => {
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);
            if (!state.moved) {
              // Web parity: click empty runway clears + seeks.
              onSelect(selectionNone());
              seekToClientX(originClientX);
              return;
            }
            applyLiveSelection(state.box);
          },
          onCancel: () => {
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);
            onSelect(selectionClips(existingIds));
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
      seekToClientX,
      selection,
      sortedLanes,
      topPadding,
    ],
  );

  const laneHeights = useMemo(
    () =>
      laneRows.map((row, i) =>
        row.height + (i < laneRows.length - 1 ? LANE_GAP_PX : 0),
      ),
    [laneRows],
  );

  const laneHeightPrefix = useMemo(
    () => buildLaneHeightPrefix(laneHeights),
    [laneHeights],
  );

  const laneIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < laneRows.length; i += 1) {
      map.set(laneRows[i]!.id, i);
    }
    return map;
  }, [laneRows]);

  const laneWindow = useMemo(
    () =>
      visibleLaneWindow({
        scrollTop: Math.max(0, scrollTop - topPadding),
        viewHeight: trackViewHeight,
        laneHeights,
        prefixOffsets: laneHeightPrefix,
      }),
    [scrollTop, trackViewHeight, laneHeights, laneHeightPrefix, topPadding],
  );

  /** Window lanes + discrete pin lanes (with gap spacers; no full origin→target expand). */
  const mountedLaneRows = useMemo(() => {
    const indices = new Set<number>();
    const { startIndex, endIndex } = laneWindow;
    if (endIndex >= startIndex && startIndex < laneRows.length) {
      for (let i = startIndex; i <= endIndex; i += 1) indices.add(i);
    }
    if (movePinKey) {
      // Format: origin|lane|member1,member2
      const [origin, lane, members] = movePinKey.split("|");
      const pinIds: string[] = [];
      if (origin) pinIds.push(origin);
      if (lane) pinIds.push(lane);
      if (members) {
        for (const id of members.split(",")) {
          if (id) pinIds.push(id);
        }
      }
      for (const id of pinIds) {
        const idx = laneIndexById.get(id);
        if (idx != null) indices.add(idx);
      }
    }
    const ordered = [...indices].sort((a, b) => a - b);
    type Row =
      | { kind: "gap"; key: string; height: number }
      | { kind: "lane"; key: string; row: TimelineLaneRow; index: number };
    const rows: Row[] = [];
    if (ordered.length === 0) {
      return {
        rows,
        offsetTop: topPadding + laneWindow.offsetTop,
      };
    }
    const first = ordered[0]!;
    let offsetTop = topPadding + laneHeightPrefix[first]!;
    rows.push({
      kind: "lane",
      key: laneRows[first]!.id,
      row: laneRows[first]!,
      index: first,
    });
    let prev = first;
    for (let k = 1; k < ordered.length; k += 1) {
      const idx = ordered[k]!;
      const gap = laneHeightPrefix[idx]! - laneHeightPrefix[prev + 1]!;
      if (gap > 0) {
        rows.push({ kind: "gap", key: `gap-${prev}-${idx}`, height: gap });
      }
      rows.push({
        kind: "lane",
        key: laneRows[idx]!.id,
        row: laneRows[idx]!,
        index: idx,
      });
      prev = idx;
    }
    return { rows, offsetTop };
  }, [
    laneRows,
    laneHeightPrefix,
    laneIndexById,
    laneWindow,
    movePinKey,
    topPadding,
  ]);

  const mountedOffsetTop = mountedLaneRows.offsetTop;

  const mountedBlockHeight = mountedLaneRows.rows.reduce((s, r) => {
    if (r.kind === "gap") return s + r.height;
    const trailingGap =
      r.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
    return s + r.row.height + trailingGap;
  }, 0);
  const bottomSpacer = Math.max(
    0,
    contentHeight - mountedOffsetTop - mountedBlockHeight,
  );

  const timelineEmpty = clips.length === 0;
  const seekEnabled = !disabled && !timelineEmpty;

  const contentScrollWidth =
    hScrollContentWidth > 0
      ? hScrollContentWidth
      : Math.max(layout.canvasWidth, trackViewWidth) +
        TIMELINE_PLAYHEAD_GUTTER_PX;
  const hBarViewportWidth =
    hScrollViewportWidth > 0
      ? hScrollViewportWidth
      : Math.max(0, viewWidth - TIMELINE_LABEL_WIDTH);

  return (
    <div
      ref={boardRef}
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]"
      data-testid="timeline-viewport"
    >
      {/* Playhead scoped above the detached H-scrollbar row (CapCut). */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Playhead
          tracksOriginX={TIMELINE_TRACKS_ORIGIN_X}
          pixelsPerSecond={layout.pixelsPerSecond}
          scrollLeft={scrollLeft}
          scrollContainerRef={tracksScrollRef}
          maxTime={layout.extentSeconds}
          enabled={seekEnabled}
          muted={timelineEmpty}
        />

        {/* Sticky labels only (z-50). Gutter scrolls with timerule/lanes under labels. */}
        <div className="grid shrink-0 grid-cols-[96px_minmax(0,1fr)] overflow-hidden bg-[var(--bg-panel)]">
          <div
            className="relative z-50 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)]"
            style={{
              width: TIMELINE_LABEL_WIDTH,
              height: TIMELINE_RULER_HEIGHT_PX,
            }}
          />
          <div className="relative z-0 min-w-0 overflow-hidden">
            <TimeRuler
              duration={layout.extentSeconds}
              fps={fps}
              pixelsPerSecond={layout.pixelsPerSecond}
              viewWidth={trackViewWidth}
              scrollLeft={scrollLeft}
              originOffsetPx={TIMELINE_PLAYHEAD_GUTTER_PX}
              onSeekClick={seekEnabled ? seekToClientX : undefined}
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[96px_minmax(0,1fr)] overflow-hidden">
          <div
            className="relative z-50 shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] select-none"
            style={{ width: TIMELINE_LABEL_WIDTH }}
            onWheel={(e) => {
              if (tracksScrollRef.current) {
                tracksScrollRef.current.scrollTop += e.deltaY;
              }
            }}
          >
            <div
              className="will-change-transform"
              style={{ transform: `translate3d(0, ${-scrollTop}px, 0)` }}
            >
              <div style={{ height: mountedOffsetTop }} aria-hidden />
              {mountedLaneRows.rows.map((row) => {
                if (row.kind === "gap") {
                  return (
                    <div
                      key={`l-${row.key}`}
                      style={{ height: row.height }}
                      aria-hidden
                    />
                  );
                }
                const lane = row.row.lane;
                const trailingGap =
                  row.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
                return (
                  <div
                    key={row.key}
                    className="flex shrink-0 items-center justify-center px-2"
                    style={{
                      height: row.row.height,
                      marginBottom: trailingGap,
                      width: TIMELINE_LABEL_WIDTH,
                    }}
                    data-marquee-ignore="true"
                  >
                    <LaneFlagControls
                      lane={lane}
                      disabled={disabled}
                      leading={
                        <LaneLeadingIcon
                          kind={
                            laneContentKindById.get(lane.id) ?? "component"
                          }
                        />
                      }
                      onPatch={(patch) =>
                        onExecute(
                          {
                            type: "update-lane-flags",
                            laneId: lane.id,
                            patch,
                          },
                          "Lane flags",
                        )
                      }
                    />
                  </div>
                );
              })}
              <div style={{ height: bottomSpacer }} aria-hidden />
            </div>
          </div>

          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <TimelineContextMenu
              className="relative z-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              selection={selection}
              disabled={disabled}
              canPaste={canPaste}
              onCopy={onCopy}
              onCut={onCut}
              onPaste={onPaste}
              onExecute={onExecute}
              getPlayheadTime={getPlayheadTime}
            >
            <div className="relative min-h-0 flex-1">
              <div
                ref={tracksScrollRef}
                className="timeline-tracks-scroll relative z-0 h-full min-h-0 select-none overflow-x-auto overflow-y-auto bg-[var(--bg-panel)]"
                data-timeline-drop-zone="true"
                data-pixels-per-second={layout.pixelsPerSecond}
                onScroll={onScroll}
                onPointerDown={(event) => {
                  if (disabled || timelineEmpty || event.button !== 0) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-clip-id]")) return;
                  if (target.closest("button")) return;
                  if (target.closest("[data-marquee-ignore]")) return;
                  // Web/CapCut: empty-runway drag → marquee (no Shift required).
                  beginMarquee(event);
                }}
              >
              {laneRows.length === 0 ? (
                <p className="p-6 text-[13px] text-[var(--fg-muted)]">
                  No lanes in this project.
                </p>
              ) : (
                <div
                  className="relative min-h-full"
                  style={{
                    width: Math.max(layout.canvasWidth, trackViewWidth),
                    height: contentHeight,
                    minWidth:
                      Math.max(layout.canvasWidth, trackViewWidth) +
                      TIMELINE_PLAYHEAD_GUTTER_PX,
                    paddingLeft: TIMELINE_PLAYHEAD_GUTTER_PX,
                  }}
                >
                  {timelineEmpty ? (
                    <>
                      <div style={{ height: topPadding }} aria-hidden />
                      <EmptyTimelineDash
                        width={Math.max(layout.canvasWidth, trackViewWidth)}
                        laneId={
                          laneRows.find((r) => r.role === "base")?.id ??
                          laneRows[0]?.id ??
                          null
                        }
                      />
                      <div style={{ height: bottomSpacer }} aria-hidden />
                    </>
                  ) : (
                    <>
                      <div style={{ height: mountedOffsetTop }} aria-hidden />
                      {mountedLaneRows.rows.map((row) => {
                        if (row.kind === "gap") {
                          return (
                            <div
                              key={`t-${row.key}`}
                              style={{ height: row.height }}
                              aria-hidden
                            />
                          );
                        }
                        const lane = row.row.lane;
                        const h = row.row.height;
                        const trailingGap =
                          row.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
                        const visibleClips = clipsForLane(lane.id);
                        return (
                          <div
                            key={lane.id}
                            className="relative box-border bg-[var(--timeline-track-lane)]"
                            style={{ height: h, marginBottom: trailingGap }}
                            data-lane-id={lane.id}
                            data-track-lane="true"
                            {...laneDropDomAttrs(lane)}
                          >
                            <ClipStrip
                              clips={visibleClips}
                              allClips={clips}
                              lanes={lanes}
                              lane={lane}
                              pixelsPerSecond={layout.pixelsPerSecond}
                              selection={selection}
                              disabled={disabled}
                              beginGesture={beginGesture}
                              onSelect={onSelect}
                              onExecute={onExecute}
                            />
                          </div>
                        );
                      })}
                      <div style={{ height: bottomSpacer }} aria-hidden />
                      <TimelineOverlays
                        pixelsPerSecond={layout.pixelsPerSecond}
                        canvasWidth={layout.canvasWidth}
                        trackViewWidth={trackViewWidth}
                        contentHeight={contentHeight}
                        timelineEmpty={false}
                        tracksScrollRef={tracksScrollRef}
                        scrollLeft={scrollLeft}
                      />
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </TimelineContextMenu>
          </div>
        </div>
      </div>

      {/* Detached CapCut H-scrollbar — custom thumb, panel-colored track */}
      <div
        className="relative z-[50] grid shrink-0 grid-cols-[96px_minmax(0,1fr)] bg-[var(--bg-panel)]"
        data-testid="timeline-h-scroll-row"
      >
        <div
          className="border-r border-[var(--border-subtle)] bg-[var(--bg-panel)]"
          style={{ width: TIMELINE_LABEL_WIDTH }}
          aria-hidden
        />
        <TimelineHScrollBar
          scrollLeft={scrollLeft}
          contentWidth={contentScrollWidth}
          viewportWidth={hBarViewportWidth}
          onScrollLeft={onHScrollLeft}
        />
      </div>
    </div>
  );
}
