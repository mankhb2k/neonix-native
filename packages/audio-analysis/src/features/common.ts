import type { EnergyFrame } from "../schema";

/**
 * Shared DSP helpers. All feature extractors operate on mono Float32Array
 * PCM in the range [-1, 1], which keeps them trivially testable with
 * synthetic sine/silence/noise signals (no Web Audio needed).
 */

/** Number of samples per hop frame (never less than 1). */
export function hopSizeFor(sampleRate: number, hopSeconds: number): number {
  return Math.max(1, Math.round(sampleRate * hopSeconds));
}

/** Root-mean-square amplitude per hop frame. Values lie in [0, 1] for PCM in [-1, 1]. */
export function frameRms(
  samples: Float32Array,
  sampleRate: number,
  hopSeconds: number,
): number[] {
  const hop = hopSizeFor(sampleRate, hopSeconds);
  const out: number[] = [];
  for (let start = 0; start < samples.length; start += hop) {
    const end = Math.min(start + hop, samples.length);
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += samples[i] * samples[i];
    }
    out.push(Math.sqrt(sum / (end - start)));
  }
  return out;
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Centered moving average used to reduce keyframe jitter. */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  const half = Math.floor(window / 2);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += values[j];
    out.push(sum / (end - start));
  }
  return out;
}

/** Convert raw values into clamped `EnergyFrame[]` with per-frame time offsets. */
export function toEnergyFrames(
  values: number[],
  sampleRate: number,
  hopSeconds: number,
): EnergyFrame[] {
  const hop = hopSizeFor(sampleRate, hopSeconds);
  return values.map((value, i) => ({
    t: (i * hop) / sampleRate,
    value: clamp01(value),
  }));
}
