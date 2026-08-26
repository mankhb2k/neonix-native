import type { TimelineClip } from "./model/timeline-types";

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

/** Default duration used when a library item has no explicit duration. */
export const DEFAULT_FRAME_DURATION = 5;
/** Minimum duration accepted when splitting a timeline clip. */
export const MIN_CLIP_SLICE_SEC = 0.05;

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
