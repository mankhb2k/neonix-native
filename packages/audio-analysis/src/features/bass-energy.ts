import type { EnergyFrame } from "../schema";
import { frameRms, movingAverage, toEnergyFrames } from "./common";

export type BassEnergyOptions = {
  hopSeconds?: number;
  /** Low-pass cutoff in Hz. Default 160 (covers kick/sub-bass). */
  cutoffHz?: number;
  smoothingFrames?: number;
};

/**
 * One-pole IIR low-pass filter. Cheap MVP stand-in for FFT band energy
 * (20..160 Hz). Attenuates treble so only sub/bass contributes to the RMS.
 */
export function lowPass(
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  if (cutoffHz <= 0 || sampleRate <= 0) return samples.slice();
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = alpha * samples[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

/**
 * Bass energy: RMS of the low-passed signal.
 *
 * A pure bass tone scores high; a pure treble tone scores near zero, which
 * is what lets beats and neon pulses track the low end only.
 */
export function computeBassEnergy(
  samples: Float32Array,
  sampleRate: number,
  options: BassEnergyOptions = {},
): EnergyFrame[] {
  const hopSeconds = options.hopSeconds ?? 0.05;
  const cutoffHz = options.cutoffHz ?? 160;
  const smoothingFrames = options.smoothingFrames ?? 3;

  const filtered = lowPass(samples, sampleRate, cutoffHz);
  const rms = frameRms(filtered, sampleRate, hopSeconds);
  const smoothed = movingAverage(rms, smoothingFrames);
  return toEnergyFrames(smoothed, sampleRate, hopSeconds);
}
