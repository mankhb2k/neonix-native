export type FrameTimestamp = {
  frameIndex: number;
  fps: number;
  time: number;
};

import { FRAME_EPSILON, deterministicUint32 } from "./determinism";

function assertFrameRate(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("FPS must be a finite positive number");
}

export function frameTimestamp(frameIndex: number, fps: number): FrameTimestamp {
  assertFrameRate(fps);
  if (!Number.isSafeInteger(frameIndex) || frameIndex < 0) throw new Error("Frame index must be a non-negative safe integer");
  return { frameIndex, fps, time: frameIndex / fps };
}

export function frameIndexAtTime(time: number, fps: number): number {
  assertFrameRate(fps);
  if (!Number.isFinite(time) || time < 0) throw new Error("Time must be a finite non-negative number");
  return Math.floor(time * fps + FRAME_EPSILON);
}

export function quantizeTimeToFrame(time: number, fps: number): FrameTimestamp {
  return frameTimestamp(frameIndexAtTime(time, fps), fps);
}

export { deterministicUint32 };

/** Pure random-access sample: output never depends on frame evaluation order. */
export function deterministicRandom(seed: string | number, channel: string, sampleIndex: number): number {
  return deterministicUint32(seed, channel, sampleIndex) / 0x1_0000_0000;
}
