import type { AudioMotionPreset } from "./audio-to-clips";

export type NeonCirclePulsePreset = {
  beatGlow: { base: number; peak: number; attackSeconds: number; releaseSeconds: number };
  beatScale: { base: number; peak: number; attackSeconds: number; releaseSeconds: number };
  bassScale: { min: number; max: number };
  loudnessBrightness: { min: number; max: number };
};

/**
 * `neon-circle-pulse` preset.
 *
 * Value conventions for generated keyframes:
 * - opacity: 0..100
 * - scale:   multiplier (1.0 = base)
 */
export const NEON_CIRCLE_PULSE_PRESET: NeonCirclePulsePreset = {
  beatGlow: { base: 25, peak: 100, attackSeconds: 0.03, releaseSeconds: 0.15 },
  beatScale: { base: 1, peak: 1.08, attackSeconds: 0.02, releaseSeconds: 0.2 },
  bassScale: { min: 1, max: 1.12 },
  loudnessBrightness: { min: 20, max: 80 },
};

export function presetFor(preset: AudioMotionPreset): NeonCirclePulsePreset {
  switch (preset) {
    case "neon-circle-pulse":
      return NEON_CIRCLE_PULSE_PRESET;
    default:
      throw new Error(`Unknown audio motion preset: ${String(preset)}`);
  }
}
