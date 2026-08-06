import { useLayoutEffect, type RefObject } from "react";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import { collectClipEdgeSnapPoints } from "@motionvideo/editor-interactions";
import {
  registerTimelineDropHost,
  type TimelineDropHost,
} from "../drop/library-drop";
import { LANE_GAP_PX } from "../lanes/timeline-lane-rows";
import {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  SECONDARY_LANE_HEIGHT_PX,
  laneRowHeightPx,
} from "../timeline-scale";

type LaneDropIndexes = {
  siblingLaneRefs: TimelineDropHost["siblingLaneRefs"];
  overlayLaneRefs: TimelineDropHost["overlayLaneRefs"];
  audioLaneRefs: TimelineDropHost["audioLaneRefs"];
};

type Args = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  sortedLanes: TimelineLane[];
  topPadding: number;
  pixelsPerSecond: number;
  clips: TimelineClip[];
  autoSnapping: boolean;
  clipsByLane: Map<string, TimelineClip[]>;
  laneDropIndexes: LaneDropIndexes;
  laneHeightPrefix: number[];
  laneContentHeights: number[];
  layerMode?: TimelineDropHost["layerMode"];
};

/** Registers the scroll container as the library/clip drop host (CapCut collectors). */
export function useTimelineDropHostRegistration({
  tracksScrollRef,
  sortedLanes,
  topPadding,
  pixelsPerSecond,
  clips,
  autoSnapping,
  clipsByLane,
  laneDropIndexes,
  laneHeightPrefix,
  laneContentHeights,
  layerMode,
}: Args): void {
  useLayoutEffect(() => {
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) return undefined;
    const next: TimelineDropHost = {
      scrollEl,
      lanes: sortedLanes,
      lanesTop: topPadding,
      laneHeight: SECONDARY_LANE_HEIGHT_PX,
      laneHeightFor: laneRowHeightPx,
      laneGapPx: LANE_GAP_PX,
      pixelsPerSecond,
      tracksOriginX: TIMELINE_PLAYHEAD_GUTTER_PX,
      snapPoints: autoSnapping
        ? collectClipEdgeSnapPoints(clips, new Set())
        : [],
      snapThresholdSec: 8 / Math.max(1e-6, pixelsPerSecond),
      clips,
      clipsByLane,
      siblingLaneRefs: laneDropIndexes.siblingLaneRefs,
      overlayLaneRefs: laneDropIndexes.overlayLaneRefs,
      audioLaneRefs: laneDropIndexes.audioLaneRefs,
      laneHitLayout: {
        topPadding,
        laneHeightPrefix,
        laneContentHeights,
      },
      layerMode,
    };
    return registerTimelineDropHost(next);
  }, [
    sortedLanes,
    pixelsPerSecond,
    topPadding,
    clips,
    autoSnapping,
    clipsByLane,
    laneDropIndexes,
    laneHeightPrefix,
    laneContentHeights,
    layerMode,
  ]);
}
