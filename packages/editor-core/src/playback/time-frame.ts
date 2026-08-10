/**
 * Frame ↔ time helpers for preview (shared web/desktop).
 */
import { frameIndexAtTime } from "@motionvideo/motion-runtime";

/** Shared floor-based frame index (matches preview + timecode). */
export function playbackFrameIndex(time: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  try {
    return frameIndexAtTime(safeTime, safeFps);
  } catch {
    return Math.floor(safeTime * safeFps + Number.EPSILON * 8);
  }
}

/** Quantized time at the start of the display frame. */
export function playbackFrameTime(time: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  return playbackFrameIndex(time, safeFps) / safeFps;
}
