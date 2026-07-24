export type FrameTimestamp = {
  frameIndex: number;
  fps: number;
  time: number;
};

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
  return Math.floor(time * fps + Number.EPSILON * 8);
}

export function quantizeTimeToFrame(time: number, fps: number): FrameTimestamp {
  return frameTimestamp(frameIndexAtTime(time, fps), fps);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function deterministicUint32(seed: string | number, channel: string, sampleIndex: number): number {
  if (!Number.isSafeInteger(sampleIndex) || sampleIndex < 0) throw new Error("Sample index must be a non-negative safe integer");
  const seedHash = typeof seed === "number" ? mix32(seed) : fnv1a(seed);
  return mix32(seedHash ^ fnv1a(channel) ^ mix32(sampleIndex));
}

/** Pure random-access sample: output never depends on frame evaluation order. */
export function deterministicRandom(seed: string | number, channel: string, sampleIndex: number): number {
  return deterministicUint32(seed, channel, sampleIndex) / 0x1_0000_0000;
}
