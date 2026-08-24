/**
 * Web adapter — wraps useClipMove from editor-react with CapCut lane targeting.
 * Visual clips stay on Main / overlays (zIndex ≥ 0); audio uses zIndex < 0.
 */

import { useMemo, type RefObject } from "react";
import { useClipMove as useClipMoveShared } from "@/hooks/editor/timeline/use-clip-move";
import type { BeginGesture } from "@/hooks/editor/pointer/use-pointer-session-host";
import type { ClipMoveHost } from "@/hooks/editor/timeline/gesture-host";
import {
  resolveLaneTrackKind,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core/timeline-runtime";
import {
  computeAutoScrollNearEdge,
  type ClipMovePreview,
} from "@motionvideo/editor-core/timeline-runtime";
import {
  getTimelineLibraryDropHost,
  resolveClipMoveDropAtY,
} from "@/lib/editor/library/timeline-library-drop";
import {
  BASE_LANE_HEIGHT_PX,
  SECONDARY_LANE_HEIGHT_PX,
  TIMELINE_START_GUTTER_PX,
} from "../timeline-scale";

export type UseClipMoveArgs = {
  clips: TimelineClip[];
  allClips?: TimelineClip[];
  lanes: TimelineLane[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  /** Group surface: one child per row (swap / insert, never pack). */
  exclusiveRows?: boolean;
  autoSnapping?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
  scrollRef: RefObject<HTMLElement | null>;
};

function laneRowHeightPx(
  lane: TimelineLane,
  clips: readonly TimelineClip[],
): number {
  if (lane.kind === "audio") return SECONDARY_LANE_HEIGHT_PX;
  const clip = clips.find((candidate) => candidate.laneId === lane.id);
  return clip?.kind === "scene" &&
    (clip.mediaType === "image" || clip.mediaType === "video")
    ? BASE_LANE_HEIGHT_PX
    : SECONDARY_LANE_HEIGHT_PX;
}

export function useClipMove({
  clips,
  allClips,
  lanes,
  lane,
  pixelsPerSecond,
  selection,
  disabled,
  exclusiveRows = false,
  autoSnapping = true,
  beginGesture,
  onSelect,
  onExecute,
  onMovePreview,
  scrollRef,
}: UseClipMoveArgs) {
  const host: ClipMoveHost = useMemo(
    () => ({
      exclusiveRows,
      autoScrollNearEdge: (clientX: number, clientY: number) => {
        const el = scrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const delta = computeAutoScrollNearEdge({
          clientX,
          clientY,
          viewport: {
            clientLeft: rect.left,
            clientTop: rect.top,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            tracksOriginX: TIMELINE_START_GUTTER_PX,
          },
        });
        if (delta.scrollLeftDelta !== 0) {
          el.scrollLeft = delta.nextScrollLeft;
        }
        if (delta.scrollTopDelta !== 0) {
          el.scrollTop = delta.nextScrollTop;
        }
      },

      pointerContentXAtPoint: (clientX: number): number | null => {
        const dropHost = getTimelineLibraryDropHost();
        const origin = dropHost?.tracksOriginX ?? TIMELINE_START_GUTTER_PX;
        const el = dropHost?.scrollEl ?? scrollRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return clientX - rect.left + el.scrollLeft - origin;
      },

      getDropContext: () => {
        const el = scrollRef.current;
        if (!el) return null;
        const dropHost = getTimelineLibraryDropHost();
        return {
          scrollEl: el,
          lanes: dropHost?.lanes ?? lanes,
          clipsByLane: dropHost?.clipsByLane,
          laneHitLayout: dropHost?.laneHitLayout ?? undefined,
        };
      },

      resolveDropAtY: (
        scrollEl,
        clientY,
        family,
        wasInsert,
        dropLanes,
        layout,
      ) => {
        const hit = resolveClipMoveDropAtY(
          scrollEl,
          clientY,
          family,
          wasInsert,
          dropLanes,
          layout,
        );
        if (hit) return hit;
        if (family === "audio") return null;
        const base = dropLanes.find(
          (l) => l.kind === "visual" && l.role === "base",
        );
        return {
          family: "visual",
          isInsert: false,
          laneId: base?.id ?? null,
          insertOrder: null,
          indicatorTop: 0,
          overBaseBody: true,
        };
      },

      trackForLane: resolveLaneTrackKind,

      laneRowHeightPx: (targetLane) =>
        laneRowHeightPx(targetLane, allClips ?? clips),
    }),
    [allClips, clips, scrollRef, lanes, exclusiveRows],
  );

  return useClipMoveShared({
    clips,
    allClips,
    lanes,
    lane,
    pixelsPerSecond,
    selection,
    disabled,
    autoSnapping,
    beginGesture,
    onSelect,
    onCommand: onExecute,
    onMovePreview,
    host,
  });
}
