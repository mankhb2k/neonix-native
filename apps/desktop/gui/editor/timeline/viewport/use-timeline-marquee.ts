import { useCallback, useRef, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { autoScrollElementNearEdge } from "../drop/auto-scroll";
import {
  setMarquee,
  setMarqueeSelectionIds,
} from "../interactions/timeline-preview-session";
import type { BeginGesture } from "../interactions/use-pointer-session";
import {
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  marqueeTrackScrollBounds,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  shouldPublishMarqueeIds,
  type MarqueeRect,
} from "../selection/marquee-geometry";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";

const MARQUEE_THRESHOLD_PX = 4;
/** Match web useTimelineAutoScroll edge band. */
const MARQUEE_EDGE_PX = 48;
const MARQUEE_SCROLL_STEP_PX = 14;

type Args = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  disabled: boolean | undefined;
  selection: EditorSelection;
  beginGesture: BeginGesture;
  laneHeightPrefix: number[];
  laneContentHeights: number[];
  topPadding: number;
  sortedLanes: TimelineLane[];
  clipsByLaneMap: Map<string, TimelineClip[]>;
  pixelsPerSecond: number;
  onSelect: (selection: EditorSelection) => void;
  seekToClientX: (clientX: number) => void;
};

export function useTimelineMarquee({
  tracksScrollRef,
  disabled,
  selection,
  beginGesture,
  laneHeightPrefix,
  laneContentHeights,
  topPadding,
  sortedLanes,
  clipsByLaneMap,
  pixelsPerSecond,
  onSelect,
  seekToClientX,
}: Args): (event: ReactPointerEvent<HTMLDivElement>) => void {
  // High-churn props stored in refs so useCallback stays stable.
  // All values are read at gesture-start or within the RAF loop,
  // never stale because refs are updated synchronously before any event fires.
  const selectionRef = useRef(selection);
  const laneHeightPrefixRef = useRef(laneHeightPrefix);
  const laneContentHeightsRef = useRef(laneContentHeights);
  const topPaddingRef = useRef(topPadding);
  const sortedLanesRef = useRef(sortedLanes);
  const clipsByLaneMapRef = useRef(clipsByLaneMap);
  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const onSelectRef = useRef(onSelect);
  const seekToClientXRef = useRef(seekToClientX);

  selectionRef.current = selection;
  laneHeightPrefixRef.current = laneHeightPrefix;
  laneContentHeightsRef.current = laneContentHeights;
  topPaddingRef.current = topPadding;
  sortedLanesRef.current = sortedLanes;
  clipsByLaneMapRef.current = clipsByLaneMap;
  pixelsPerSecondRef.current = pixelsPerSecond;
  onSelectRef.current = onSelect;
  seekToClientXRef.current = seekToClientX;

  return useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;

      // Snapshot all refs at gesture-start. These values are stable for
      // the entire duration of the gesture even if props change mid-drag.
      const laneHeightPrefix = laneHeightPrefixRef.current;
      const laneContentHeights = laneContentHeightsRef.current;
      const topPadding = topPaddingRef.current;
      const sortedLanes = sortedLanesRef.current;
      const clipsByLaneMap = clipsByLaneMapRef.current;
      const pixelsPerSecond = pixelsPerSecondRef.current;
      const onSelect = onSelectRef.current;
      const seekToClientX = seekToClientXRef.current;

      const rect = scroll.getBoundingClientRect();
      const origin = {
        x: event.clientX - rect.left + scroll.scrollLeft,
        y: event.clientY - rect.top + scroll.scrollTop,
      };
      const originClientX = event.clientX;
      const existingIds = selectedClipIdsFrom(selectionRef.current);
      let shiftHeld = event.shiftKey;
      let lastLiveIds: string[] | null = null;
      let lastClient = { x: event.clientX, y: event.clientY };
      let edgeRaf: number | null = null;
      let gestureAlive = true;

      const onShiftKey = (ev: KeyboardEvent) => {
        if (ev.key === "Shift") {
          shiftHeld = ev.type === "keydown" || ev.shiftKey;
        }
      };

      const trackBounds = () =>
        marqueeTrackScrollBounds({
          topPadding,
          laneHeightPrefix,
          laneContentHeights,
          viewportHeight: scroll.clientHeight,
        });

      const resolveHits = (box: MarqueeRect) =>
        clipIdsInMarqueeIndexed(box, {
          laneHeightPrefix,
          laneContentHeights,
          topPadding,
          laneCount: sortedLanes.length,
          clipsForLaneIndex: (laneIndex) =>
            clipsByLaneMap.get(sortedLanes[laneIndex]!.id) ?? [],
          pixelsPerSecond,
          tracksOriginX: TIMELINE_PLAYHEAD_GUTTER_PX,
        });

      const applyLivePreview = (box: MarqueeRect) => {
        const hits = resolveHits(box);
        const next = resolveMarqueeSelectionIds(hits, existingIds, shiftHeld);
        if (!shouldPublishMarqueeIds(lastLiveIds, next)) return;
        lastLiveIds = next;
        setMarqueeSelectionIds(next);
      };

      const commitSelection = (ids: readonly string[]) => {
        const committed = commitMarqueeSelectionIds(ids);
        if (committed.kind === "none") onSelect(selectionNone());
        else onSelect(selectionClips(committed.ids));
      };

      const stopEdgeLoop = () => {
        gestureAlive = false;
        if (edgeRaf != null) {
          cancelAnimationFrame(edgeRaf);
          edgeRaf = null;
        }
      };

      const buildBoxFromClient = (clientX: number, clientY: number) => {
        autoScrollElementNearEdge(
          scroll,
          clientX,
          clientY,
          MARQUEE_EDGE_PX,
          MARQUEE_SCROLL_STEP_PX,
          undefined,
        );
        return computeBoxFromClient(clientX, clientY);
      };

      /**
       * Geometry-only variant — does NOT trigger auto-scroll.
       * Used by onCommit to avoid scrolling one extra step on mouse-up.
       */
      const computeBoxFromClient = (clientX: number, clientY: number) => {
        const bounds = trackBounds();
        const r = scroll.getBoundingClientRect();
        const rawY = clientY - r.top + scroll.scrollTop;
        const next = {
          x: clientX - r.left + scroll.scrollLeft,
          y: bounds != null ? Math.min(rawY, bounds.maxWorkspaceY) : rawY,
        };
        const box = normalizeMarquee(origin, next);
        const moved =
          Math.hypot(next.x - origin.x, next.y - origin.y) >=
          MARQUEE_THRESHOLD_PX;
        return { box, moved };
      };

      const nearEdgeAndCanScroll = (clientX: number, clientY: number) => {
        const r = scroll.getBoundingClientRect();
        const nativeMaxTop = Math.max(
          0,
          scroll.scrollHeight - scroll.clientHeight,
        );
        const maxTop = nativeMaxTop;
        const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
        const nearBottom = clientY >= r.bottom - MARQUEE_EDGE_PX;
        const nearTop = clientY <= r.top + MARQUEE_EDGE_PX;
        const nearRight = clientX > r.right - MARQUEE_EDGE_PX;
        const nearLeft = clientX < r.left + MARQUEE_EDGE_PX;
        const canDown = nearBottom && scroll.scrollTop < maxTop;
        const canUp = nearTop && scroll.scrollTop > 0;
        const canRight = nearRight && scroll.scrollLeft < maxLeft;
        const canLeft = nearLeft && scroll.scrollLeft > 0;
        return canDown || canUp || canRight || canLeft;
      };

      const ensureEdgeLoop = () => {
        if (edgeRaf != null) return;
        const tick = () => {
          edgeRaf = null;
          if (!gestureAlive) return;
          if (!nearEdgeAndCanScroll(lastClient.x, lastClient.y)) return;
          const state = buildBoxFromClient(lastClient.x, lastClient.y);
          setMarquee(state.box);
          if (state.moved) applyLivePreview(state.box);
          if (nearEdgeAndCanScroll(lastClient.x, lastClient.y)) {
            edgeRaf = requestAnimationFrame(tick);
          }
        };
        edgeRaf = requestAnimationFrame(tick);
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
            lastClient = { x: pos.x, y: pos.y };
            const state = buildBoxFromClient(pos.x, pos.y);
            setMarquee(state.box);
            if (state.moved) applyLivePreview(state.box);
            ensureEdgeLoop();
            return state;
          },
          onCommit: (state) => {
            stopEdgeLoop();
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);

            // Use geometry-only variant: avoids scrolling one extra step on mouse-up.
            const finalState = computeBoxFromClient(lastClient.x, lastClient.y);
            const moved = state.moved || finalState.moved;

            if (!moved) {
              onSelect(selectionNone());
              seekToClientX(originClientX);
              return;
            }
            const hits = resolveHits(finalState.box);
            const next = resolveMarqueeSelectionIds(
              hits,
              existingIds,
              shiftHeld,
            );
            commitSelection(next);
          },
          onCancel: () => {
            stopEdgeLoop();
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
    // Only truly structural deps that cannot be ref-ified:
    // - tracksScrollRef: ref object itself (stable, but scroll target may change)
    // - beginGesture: stable from usePointerSessionHost
    // - disabled: controls whether the gesture is allowed to start at all;
    //   must be in deps so the callback reflects the latest disabled state.
    [beginGesture, disabled, tracksScrollRef],
  );
}

