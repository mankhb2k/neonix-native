/**
 * Audio export manifest — serialized audio plan for render manifest.
 *
 * §Phase 10 Task 10.3 in core-engine-tasks.md
 *
 * Builds a summary of audio clips from the compiled runtime, suitable
 * for embedding in RenderManifest.audio.
 */

import type { AudioRenderPlan, AudioRenderClip } from "./audio-render-plan";

export type AudioExportManifest = {
  /** Total number of audio clips. */
  clipCount: number;
  /** Total audio duration in seconds (including loops). */
  totalDurationSeconds: number;
  /** Sample rate for audio rendering. */
  sampleRate: number;
  /** Audio codec for export. */
  codec: "aac" | "opus" | "mp3" | "pcm";
  /** Per-clip metadata. */
  clips: AudioExportClip[];
};

export type AudioExportClip = {
  /** Clip ID. */
  clipId: string;
  /** Asset duration (seconds). */
  assetDurationSeconds: number;
  /** Trim start (seconds). */
  trimStartSeconds: number;
  /** Trim end (seconds). */
  trimEndSeconds: number;
  /** Playback start time in composition (seconds). */
  startTime: number;
  /** Playback end time in composition (seconds). */
  endTime: number;
  /** Loop configuration. */
  loop: boolean;
  /** Loop window (if looping). */
  loopWindowStartSeconds?: number;
  loopWindowEndSeconds?: number;
  /** Channel policy. */
  channelPolicy: "stereo" | "mono" | "left-only" | "right-only";
  /** Volume envelope keyframes. */
  volumeKeyframes: Array<{ time: number; value: number }>;
};

// ── Default values ────────────────────────────────────────────────────

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_CODEC = "aac" as const;

// ── Builder ───────────────────────────────────────────────────────────

/**
 * Build an AudioExportManifest from an AudioRenderPlan.
 * Used when constructing RenderManifest for export.
 */
export function buildAudioExportManifest(
  plan: AudioRenderPlan,
  options?: {
    sampleRate?: number;
    codec?: AudioExportManifest["codec"];
  },
): AudioExportManifest {
  const sampleRate = options?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const codec = options?.codec ?? DEFAULT_CODEC;

  const clips: AudioExportClip[] = plan.clips.map((clip) =>
    clipToExportClip(clip),
  );

  const totalDurationSeconds = plan.clips.reduce((sum, clip) => {
    const duration = clip.endTime - clip.startTime;
    return sum + Math.max(0, duration);
  }, 0);

  return {
    clipCount: clips.length,
    totalDurationSeconds: Math.round(totalDurationSeconds * 1000) / 1000,
    sampleRate,
    codec,
    clips,
  };
}

function clipToExportClip(clip: AudioRenderClip): AudioExportClip {
  const volumeKeyframes: Array<{ time: number; value: number }> = [];

  // Extract keyframes from the volume envelope
  if (clip.volume) {
    for (let t = clip.startTime; t <= clip.endTime; t += 1 / 30) {
      const v = clip.volume.getValue(t);
      volumeKeyframes.push({
        time: Math.round(t * 1000) / 1000,
        value: Math.round(v * 1000) / 1000,
      });
    }
  }

  // Compress volume keyframes (keep only inflection points)
  const compressed = compressVolumeKeyframes(volumeKeyframes);

  return {
    clipId: clip.clipId,
    assetDurationSeconds: clip.assetDurationSeconds,
    trimStartSeconds: clip.trimStartSeconds ?? 0,
    trimEndSeconds: clip.trimEndSeconds ?? clip.assetDurationSeconds,
    startTime: clip.startTime,
    endTime: clip.endTime,
    loop: clip.loop ?? false,
    loopWindowStartSeconds: clip.loopWindowStartSeconds,
    loopWindowEndSeconds: clip.loopWindowEndSeconds,
    channelPolicy: clip.channelPolicy ?? "stereo",
    volumeKeyframes: compressed,
  };
}

/**
 * Compress volume keyframes — keep only inflection points where the
 * slope changes by more than EPSILON.
 */
function compressVolumeKeyframes(
  keyframes: Array<{ time: number; value: number }>,
): Array<{ time: number; value: number }> {
  if (keyframes.length <= 2) return keyframes;

  const result: Array<{ time: number; value: number }> = [keyframes[0]!];

  for (let i = 1; i < keyframes.length - 1; i++) {
    const prev = keyframes[i - 1]!;
    const curr = keyframes[i]!;
    const next = keyframes[i + 1]!;

    const dt1 = curr.time - prev.time || 1;
    const dt2 = next.time - curr.time || 1;
    const slope1 = (curr.value - prev.value) / dt1;
    const slope2 = (next.value - curr.value) / dt2;

    // Keep if slope changes meaningfully (threshold 0.001)
    if (Math.abs(slope2 - slope1) > 0.001) {
      result.push(curr);
    }
  }

  result.push(keyframes[keyframes.length - 1]!);
  return result;
}
