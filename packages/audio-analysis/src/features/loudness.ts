import type { EnergyFrame } from "../schema";
import { frameRms, movingAverage, toEnergyFrames } from "./common";

export type LoudnessOptions = {
  hopSeconds?: number;
  /** Number of frames used by the smoothing moving average (1 disables). */
  smoothingFrames?: number;
};

/**
 * Per-frame RMS loudness.
 *
 * RMS is kept absolute (PCM is assumed in [-1, 1]) rather than normalized to
 * its own maximum, so "louder" audio genuinely yields higher loudness and
 * "silence" yields ~0.
 */
export function computeLoudness(
  samples: Float32Array,
  sampleRate: number,
  options: LoudnessOptions = {},
): EnergyFrame[] {
  const hopSeconds = options.hopSeconds ?? 0.05;
  const smoothingFrames = options.smoothingFrames ?? 3;

  const rms = frameRms(samples, sampleRate, hopSeconds);
  const smoothed = movingAverage(rms, smoothingFrames);
  return toEnergyFrames(smoothed, sampleRate, hopSeconds);
}
