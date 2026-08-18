/**
 * Clamp timing node trong phạm vi container (local theo scene).
 */

export type LayerTimingLocal = {
  /** Giây tương đối so với start của container (scene-local). */
  start: number;
  duration: number;
};

export function clampNodeLocalTiming(
  start: number,
  duration: number,
  containerDuration: number,
  minDuration = 0.05,
): LayerTimingLocal {
  const maxEnd = Math.max(minDuration, containerDuration);
  let nextStart = Number.isFinite(start) ? start : 0;
  let nextDuration = Number.isFinite(duration) ? duration : minDuration;
  nextDuration = Math.max(minDuration, nextDuration);
  nextStart = Math.max(0, nextStart);
  if (nextStart + nextDuration > maxEnd) {
    nextStart = Math.max(0, maxEnd - nextDuration);
  }
  if (nextStart + nextDuration > maxEnd) {
    nextDuration = Math.max(minDuration, maxEnd - nextStart);
  }
  return { start: nextStart, duration: nextDuration };
}
