/**
 * Slice a layer (group = "scene") to a local-time window for export bake.
 * Timing is reset to a local `start: 0` window of the requested duration.
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";

/**
 * Deep-clone `scene` trimmed to [localStart, localStart + duration).
 * Result timing starts at 0 and lasts `duration` seconds.
 */
export function sliceScene(
  scene: MotionLayer,
  localStart: number,
  duration: number,
): MotionLayer {
  const dur = Math.max(0.001, duration);
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionLayer;
  return {
    ...cloned,
    timing: { start: 0, duration: dur },
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
