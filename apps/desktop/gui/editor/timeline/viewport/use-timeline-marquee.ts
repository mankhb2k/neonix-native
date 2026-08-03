import { useCallback, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  type EditorSelection,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import {
  setMarquee,
  setMarqueeSelectionIds,
} from "../interactions/timeline-preview-session";
import type { BeginGesture } from "../interactions/use-pointer-session";
import {
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  normalizeMarquee,
  resolveMarqueeSelectionIds,
  shouldPublishMarqueeIds,
  type MarqueeRect,
} from "../selection/marquee-geometry";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";

const MARQUEE_THRESHOLD_PX = 4;

type Args = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  disabled: boolean | undefined;
  selection: EditorSelection;
  beginGesture: BeginGesture;
  laneHeightPrefix: number[];
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
  topPadding,
  sortedLanes,
  clipsByLaneMap,
  pixelsPerSecond,
  onSelect,
  seekToClientX,
}: Args): (event: ReactPointerEvent<HTMLDivElement>) => void {
  return useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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
      let lastLiveIds: string[] | null = null;

      const onShiftKey = (ev: KeyboardEvent) => {
        if (ev.key === "Shift") {
          shiftHeld = ev.type === "keydown" || ev.shiftKey;
        }
      };

      const resolveHits = (box: MarqueeRect) =>
        clipIdsInMarqueeIndexed(box, {
          laneHeightPrefix,
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
            if (moved) applyLivePreview(box);
            return { box, moved };
          },
          onCommit: (state) => {
            window.removeEventListener("keydown", onShiftKey);
            window.removeEventListener("keyup", onShiftKey);
            setMarquee(null);
            if (!state.moved) {
              onSelect(selectionNone());
              seekToClientX(originClientX);
              return;
            }
            const hits = resolveHits(state.box);
            const next = resolveMarqueeSelectionIds(
              hits,
              existingIds,
              shiftHeld,
            );
            commitSelection(next);
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
      laneHeightPrefix,
      onSelect,
      pixelsPerSecond,
      seekToClientX,
      selection,
      sortedLanes,
      topPadding,
      tracksScrollRef,
    ],
  );
}