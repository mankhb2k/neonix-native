import type { Beat, EnergyFrame } from "../schema";
import { clamp01 } from "./common";

export type BeatDetectionOptions = {
  /** Peak when value > movingAverage * threshold. Default 1.35. */
  threshold?: number;
  /** Minimum gap between consecutive beats in seconds. Default 0.25. */
  minBeatGap?: number;
  /** Window length used for the moving average, in seconds. Default 1.0. */
  averageWindowSeconds?: number;
};

/**
 * Detect beat timestamps from bass energy via moving-average peak picking.
 *
 * A frame is a beat when it is a local maximum, exceeds
 * `movingAverage * threshold`, and is at least `minBeatGap` after the
 * previous beat.
 */
export function detectBeats(
  bassEnergy: EnergyFrame[],
  options: BeatDetectionOptions = {},
): Beat[] {
  const threshold = options.threshold ?? 1.35;
  const minBeatGap = options.minBeatGap ?? 0.25;
  const averageWindowSeconds = options.averageWindowSeconds ?? 1.0;

  if (bassEnergy.length === 0) return [];

  const hop = bassEnergy.length > 1 ? bassEnergy[1].t - bassEnergy[0].t : 0.05;
  const windowFrames = Math.max(1, Math.round(averageWindowSeconds / hop));

  const beats: Beat[] = [];
  let lastBeatT = -Infinity;

  for (let i = 0; i < bassEnergy.length; i++) {
    const frame = bassEnergy[i];
    if (frame.value === 0) continue;

    // Local maximum (avoid flagging every frame of a plateau).
    if (i > 0 && bassEnergy[i - 1].value >= frame.value) continue;
    if (i < bassEnergy.length - 1 && bassEnergy[i + 1].value > frame.value) {
      continue;
    }

    const start = Math.max(0, i - Math.floor(windowFrames / 2));
    const end = Math.min(bassEnergy.length, start + windowFrames);
    let sum = 0;
    for (let j = start; j < end; j++) sum += bassEnergy[j].value;
    const average = sum / (end - start);

    if (frame.value > average * threshold && frame.t - lastBeatT >= minBeatGap) {
      const strength = clamp01(
        (frame.value - average) / (average * (threshold - 1) + 1e-6),
      );
      beats.push({ t: frame.t, strength });
      lastBeatT = frame.t;
    }
  }

  return beats;
}
