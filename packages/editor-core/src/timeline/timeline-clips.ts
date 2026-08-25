import type { TimelineClip, TimelineLane } from "./model/timeline-types";

export type {
  AudioTimelineClip,
  AudioTimelineLane,
  SceneTimelineClip,
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
  VisualLanePolicy,
  VisualTimelineLane,
} from "./model/timeline-types";

export {
  DEFAULT_VISUAL_POLICY,
  isAudioClip,
  isBaseLaneObj,
  isOverlayLaneObj,
  isSceneClip,
  isVisualLane,
} from "./model/timeline-types";

/** Default duration used when a library item has no explicit duration. */
export const DEFAULT_FRAME_DURATION = 5;
/** Minimum duration accepted when splitting a timeline clip. */
export const MIN_CLIP_SLICE_SEC = 0.05;

export function isBaseLane(lanes: readonly TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((entry) => entry.id === laneId);
  return lane?.kind === "visual" && lane.role === "base";
}

export function isAudioLane(lanes: readonly TimelineLane[], laneId: string): boolean {
  return lanes.some((entry) => entry.id === laneId && entry.kind === "audio");
}

export function isOverlayLane(lanes: readonly TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((entry) => entry.id === laneId);
  return lane?.kind === "visual" && lane.role === "overlay";
}

export function laneRippleMode(lanes: readonly TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((entry) => entry.id === laneId);
  return lane?.kind === "visual" && lane.policy.rippleMode;
}

export function rangesOverlap(
  aStart: number,
  aDuration: number,
  bStart: number,
  bDuration: number,
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

export function clipsContentEndSeconds(
  clips: ReadonlyArray<Pick<TimelineClip, "startTime" | "duration">>,
): number {
  return clips.reduce(
    (end, clip) => Math.max(end, Math.max(0, clip.startTime) + Math.max(0, clip.duration)),
    0,
  );
}
