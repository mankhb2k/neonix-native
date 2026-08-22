import {
  useCallback,
  useRef,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  marqueeTrackScrollBounds,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  shouldPublishMarqueeIds,
  type MarqueeRect,
} from "@motionvideo/editor-core";
import { autoScrollElementNearEdge } from "@/lib/editor/interaction-host/timeline-dom";
import type { BeginGesture } from "../pointer/use-pointer-session-host";

const MARQUEE_THRESHOLD_PX = 4;
const MARQUEE_EDGE_PX = 48;
const MARQUEE_SCROLL_STEP_PX = 14;

export type UseTimelineMarqueeArgs = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  disabled?: boolean;
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
  /** Preview rect for overlay chrome (null clears). */
  onMarqueeRect?: (rect: MarqueeRect | null) => void;
  /** Live selection ids while dragging (null clears). */
  onMarqueeSelectionIds?: (ids: string[] | null) => void;
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
  onMarqueeRect,
  onMarqueeSelectionIds,
}: UseTimelineMarqueeArgs): (event: ReactPointerEvent<HTMLDivElement>) => void {
  const selectionRef = useRef(selection);
  const laneHeightPrefixRef = useRef(laneHeightPrefix);
  const laneContentHeightsRef = useRef(laneContentHeights);
  const topPaddingRef = useRef(topPadding);
  const sortedLanesRef = useRef(sortedLanes);
  const clipsByLaneMapRef = useRef(clipsByLaneMap);
  const pixelsPerSecondRef = useRef(pixelsPerSecond);
  const onSelectRef = useRef(onSelect);
  const seekToClientXRef = useRef(seekToClientX);
  const onMarqueeRectRef = useRef(onMarqueeRect);
  const onMarqueeSelectionIdsRef = useRef(onMarqueeSelectionIds);

  selectionRef.current = selection;
  laneHeightPrefixRef.current = laneHeightPrefix;
  laneContentHeightsRef.current = laneContentHeights;
  topPaddingRef.current = topPadding;
  sortedLanesRef.current = sortedLanes;
  clipsByLaneMapRef.current = clipsByLaneMap;
  pixelsPerSecondRef.current = pixelsPerSecond;
  onSelectRef.current = onSelect;
  seekToClientXRef.current = seekToClientX;
  onMarqueeRectRef.current = onMarqueeRect;
  onMarqueeSelectionIdsRef.current = onMarqueeSelectionIds;

  return useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;

      const laneHeightPrefix = laneHeightPrefixRef.current;
      const laneContentHeights = laneContentHeightsRef.current;
      const topPadding = topPaddingRef.current;
      const sortedLanes = sortedLanesRef.current;
      const clipsByLaneMap = clipsByLaneMapRef.current;
      const pixelsPerSecond = pixelsPerSecondRef.current;
      const onSelect = onSelectRef.current;
      const seekToClientX = seekToClientXRef.current;
      const setMarquee = (rect: MarqueeRect | null) =>
        onMarqueeRectRef.current?.(rect);
      const setMarqueeSelectionIds = (ids: string[] | null) =>
        onMarqueeSelectionIdsRef.current?.(ids);

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
            setMarqueeSelectionIds(null);

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
            setMarqueeSelectionIds(null);
          },
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.pointerId,
      );
    },
    [beginGesture, disabled, tracksScrollRef],
  );
}
