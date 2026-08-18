import type { AudioAnalysisV1 } from "../schema";
import { presetFor } from "./presets";

/**
 * Audio-analysis → timeline.clips mapping.
 *
 * `TimelinePropertyClipV1` is kept self-contained here. When the protocol's
 * `V1.TimelinePropertyClipV1` type is available, this shape should be
 * aligned with it (id / layerId / property / keys[{t, value}]).
 */

export type TimelineKeyframeV1 = {
  t: number;
  value: number;
};

export type TimelinePropertyClipV1 = {
  id: string;
  layerId: string;
  property: string;
  keys: TimelineKeyframeV1[];
};

export type AudioMotionPreset = "neon-circle-pulse";

export type AudioMotionTargets = {
  /** Layer id receiving scale/transform keyframes. */
  ringLayerId: string;
  /** Optional glow effect id for opacity/brightness keyframes. */
  glowEffectId?: string;
  /** Optional property path for loudness-driven brightness (defaults to `effects.{glowEffectId}.brightness`). */
  brightnessProperty?: string;
};

export type AudioToClipsOptions = {
  /** Global intensity multiplier, clamped to 0..1. Default 1. */
  intensity?: number;
  /** Maximum keyframes allowed per clip (downsamples if exceeded). Default 500. */
  maxKeysPerClip?: number;
};

export type AudioToClipsInput = {
  analysis: AudioAnalysisV1;
  preset: AudioMotionPreset;
  targets: AudioMotionTargets;
  options?: AudioToClipsOptions;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function roundSeconds(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function downsample(
  keys: TimelineKeyframeV1[],
  max: number,
): TimelineKeyframeV1[] {
  if (keys.length <= max) return keys;
  if (max <= 1) return keys.slice(0, Math.max(0, max));
  const out: TimelineKeyframeV1[] = [keys[0]];
  const step = (keys.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) {
    out.push(keys[Math.round(i * step)]);
  }
  out.push(keys[keys.length - 1]);
  return out;
}

/** Sort by time, clamp negatives, dedupe equal times (last wins), cap size. */
function finalizeKeys(
  keys: TimelineKeyframeV1[],
  maxKeys: number,
): TimelineKeyframeV1[] {
  const cleaned = keys.map((k) => ({
    t: Math.max(0, roundSeconds(k.t)),
    value: k.value,
  }));
  cleaned.sort((a, b) => a.t - b.t);

  const deduped: TimelineKeyframeV1[] = [];
  for (const key of cleaned) {
    if (deduped.length > 0 && deduped[deduped.length - 1].t === key.t) {
      deduped[deduped.length - 1] = key;
    } else {
      deduped.push(key);
    }
  }
  return downsample(deduped, maxKeys);
}

/**
 * Map an `AudioAnalysisV1` to `timeline.clips` using a named preset.
 *
 * - beats      → glow opacity spike + scale pulse
 * - bassEnergy → continuous scale
 * - loudness   → continuous brightness
 */
export function audioAnalysisToTimelineClips(
  input: AudioToClipsInput,
): TimelinePropertyClipV1[] {
  const { analysis, targets } = input;
  const intensity = clamp01(input.options?.intensity ?? 1);
  const maxKeysPerClip = input.options?.maxKeysPerClip ?? 500;
  const preset = presetFor(input.preset);

  const clips: TimelinePropertyClipV1[] = [];
  const beatWeight = (strength: number) => 0.4 + 0.6 * strength;

  // 1. beats -> glow opacity spikes
  if (targets.glowEffectId) {
    const keys: TimelineKeyframeV1[] = [];
    for (const beat of analysis.beats) {
      const peak =
        preset.beatGlow.base +
        (preset.beatGlow.peak - preset.beatGlow.base) *
          intensity *
          beatWeight(beat.strength);
      keys.push({
        t: beat.t - preset.beatGlow.attackSeconds,
        value: preset.beatGlow.base,
      });
      keys.push({ t: beat.t, value: peak });
      keys.push({
        t: beat.t + preset.beatGlow.releaseSeconds,
        value: preset.beatGlow.base,
      });
    }
    const finalized = finalizeKeys(keys, maxKeysPerClip);
    if (finalized.length > 0) {
      clips.push({
        id: "clip-beat-glow",
        layerId: targets.ringLayerId,
        property: `effects.${targets.glowEffectId}.opacity`,
        keys: finalized,
      });
    }
  }

  // 2 + 3. bassEnergy -> continuous scale, with beat pulses overlaid.
  // Both target `transform.scale`, so they are merged into a single clip:
  // beat pulse keyframes are appended last so they win on exact-time dedupe.
  {
    const keys: TimelineKeyframeV1[] = analysis.bassEnergy.map((frame) => ({
      t: frame.t,
      value:
        preset.bassScale.min +
        (preset.bassScale.max - preset.bassScale.min) * frame.value * intensity,
    }));
    for (const beat of analysis.beats) {
      const peak =
        preset.beatScale.base +
        (preset.beatScale.peak - preset.beatScale.base) *
          intensity *
          beatWeight(beat.strength);
      keys.push({
        t: beat.t - preset.beatScale.attackSeconds,
        value: preset.beatScale.base,
      });
      keys.push({ t: beat.t, value: peak });
      keys.push({
        t: beat.t + preset.beatScale.releaseSeconds,
        value: preset.beatScale.base,
      });
    }
    const finalized = finalizeKeys(keys, maxKeysPerClip);
    if (finalized.length > 0) {
      clips.push({
        id: "clip-ring-scale",
        layerId: targets.ringLayerId,
        property: "transform.scale",
        keys: finalized,
      });
    }
  }

  // 4. loudness -> continuous brightness
  {
    const brightnessProperty =
      targets.brightnessProperty ??
      (targets.glowEffectId
        ? `effects.${targets.glowEffectId}.brightness`
        : undefined);
    if (brightnessProperty) {
      const keys: TimelineKeyframeV1[] = analysis.loudness.map((frame) => ({
        t: frame.t,
        value:
          preset.loudnessBrightness.min +
          (preset.loudnessBrightness.max - preset.loudnessBrightness.min) *
            frame.value *
            intensity,
      }));
      const finalized = finalizeKeys(keys, maxKeysPerClip);
      if (finalized.length > 0) {
        clips.push({
          id: "clip-loudness-brightness",
          layerId: targets.ringLayerId,
          property: brightnessProperty,
          keys: finalized,
        });
      }
    }
  }

  return clips;
}
