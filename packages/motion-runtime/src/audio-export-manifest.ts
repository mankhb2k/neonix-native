/**
 * Audio export manifest — serialized audio plan for render manifest.
 *
 * §Phase 10 Task 10.3 in core-engine-tasks.md
 *
 * Builds a summary of audio layers from the compiled runtime, suitable
 * for embedding in RenderManifest.audio.
 */

import type { AudioRenderPlan, AudioRenderLayer } from "./audio-render-plan";
import { sampleAudioVolumeAtFrame } from "./audio-render-plan";

export type AudioExportManifest = {
  /** Total number of audio layers. */
  audioLayerCount: number;
  /** Total audio duration in seconds (including loops). */
  totalDurationSeconds: number;
  /** Sample rate for audio rendering. */
  sampleRate: number;
  /** Audio codec for export. */
  codec: "aac" | "opus" | "mp3" | "pcm";
  /** Per-layer metadata. */
  layers: AudioExportLayer[];
};

export type AudioExportLayer = {
  /** Audio layer ID. */
  layerId: string;
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

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_CODEC = "aac" as const;

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
  const fps = Math.max(1, plan.fps);

  const layers: AudioExportLayer[] = plan.layers.map((layer) =>
    layerToExportLayer(layer, fps),
  );

  const totalDurationSeconds = plan.layers.reduce((sum, layer) => {
    const duration = layer.durationInFrames / fps;
    return sum + Math.max(0, duration);
  }, 0);

  return {
    audioLayerCount: layers.length,
    totalDurationSeconds: Math.round(totalDurationSeconds * 1000) / 1000,
    sampleRate,
    codec,
    layers,
  };
}

function layerToExportLayer(
  layer: AudioRenderLayer,
  fps: number,
): AudioExportLayer {
  const startTime = layer.fromFrame / fps;
  const endTime = (layer.fromFrame + layer.durationInFrames) / fps;
  const volumeKeyframes: Array<{ time: number; value: number }> = [];

  for (
    let frame = layer.fromFrame;
    frame <= layer.fromFrame + layer.durationInFrames;
    frame += 1
  ) {
    const v = sampleAudioVolumeAtFrame(layer.volumeEnvelope, frame);
    volumeKeyframes.push({
      time: Math.round((frame / fps) * 1000) / 1000,
      value: Math.round(v * 1000) / 1000,
    });
  }

  const compressed = compressVolumeKeyframes(volumeKeyframes);

  return {
    layerId: layer.layerId,
    assetDurationSeconds: layer.assetDurationSeconds,
    trimStartSeconds: layer.trimStartSeconds,
    trimEndSeconds: layer.trimEndSeconds,
    startTime,
    endTime,
    loop: layer.loop,
    loopWindowStartSeconds: layer.loopWindowStartSeconds,
    loopWindowEndSeconds: layer.loopWindowEndSeconds,
    channelPolicy: layer.channelPolicy,
    volumeKeyframes: compressed,
  };
}

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

    if (Math.abs(slope2 - slope1) > 0.001) {
      result.push(curr);
    }
  }

  result.push(keyframes[keyframes.length - 1]!);
  return result;
}
