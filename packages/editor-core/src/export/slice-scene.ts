/**
 * Slice a MotionScene to a local-time window for export bake.
 * Shifts absolute schedules and authoring clip keyframe times by -localStart.
 */

import { V1 } from "@motionvideo/motion-protocol";
import type { MotionScene } from "@motionvideo/motion-protocol/runtime";

function shiftClip(
  clip: V1.TimelinePropertyClipV1,
  localStart: number,
): V1.TimelinePropertyClipV1 {
  return {
    ...clip,
    keys: clip.keys.map((key) => ({
      ...key,
      t: Math.max(0, key.t - localStart),
    })),
  };
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
  const clips = ((cloned.clips ?? []) as V1.TimelinePropertyClipV1[]).map(
    (clip) => shiftClip(clip, start),
  );
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
  const local = time - startTime;
  if (local <= 0) return 0;
  if (local >= clipDuration) return Math.max(0, clipDuration - 1e-6);
  return local;
}
