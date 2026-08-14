/**
 * Slice a MotionScene to a local-time window for export bake.
 * Shifts absolute schedules and track keyframe times by -localStart
 * so animations continue across timeline segment boundaries.
 */

import type { MotionClipV1 } from "@motionvideo/motion-protocol/internal";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";

type TrackTime = Extract<
  MotionClipV1["source"],
  { kind: "tracks" }
>["tracks"][number]["keys"][number]["t"];

function shiftTrackTime(t: TrackTime, localStart: number): TrackTime {
  if (typeof t === "number") return Math.max(0, t - localStart);
  // Marker-relative times stay linked; only absolute seconds shift.
  return t;
}

function shiftClipSource(
  source: MotionClipV1["source"],
  localStart: number,
): MotionClipV1["source"] {
  if (source.kind !== "tracks") return source;
  return {
    ...source,
    tracks: source.tracks.map((track) => ({
      ...track,
      keys: track.keys.map((key) => ({
        ...key,
        t: shiftTrackTime(key.t, localStart),
      })),
    })),
  };
}

function shiftClip(clip: MotionClipV1, localStart: number): MotionClipV1 {
  const source = shiftClipSource(clip.source, localStart);
  if (clip.schedule.kind === "absolute") {
    return {
      ...clip,
      schedule: {
        kind: "absolute",
        at: Math.max(0, clip.schedule.at - localStart),
      },
      source,
    };
  }
  // Relative schedules (after/with) keep dependency links; only track keys shift.
  return { ...clip, source };
}

/**
 * Deep-clone `scene` trimmed to [localStart, localStart + duration).
 * Animation timelines are shifted so t=0 in the result equals `localStart`
 * in the source scene.
 */
export function sliceScene(
  scene: MotionScene,
  localStart: number,
  duration: number,
): MotionScene {
  const start = Math.max(0, localStart);
  const dur = Math.max(0.001, duration);
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionScene;
  const clips = (cloned.clips ?? []).map((clip) => shiftClip(clip, start));
  return {
    ...cloned,
    duration: dur,
    clips,
  };
}

/** Local time of a timeline clip at global `time` (same as preview). */
export function clipLocalTime(
  startTime: number,
  clipDuration: number,
  time: number,
): number {
  return Math.min(
    Math.max(0, time - startTime),
    Math.max(0, clipDuration - 1e-6),
  );
}
