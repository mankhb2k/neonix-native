/**
 * AudioRenderPlan — shared audio timing for Pixi Web Audio and Remotion adapters.
 */

import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

export type AudioVolumeKeyframe = {
  frame: number;
  value: number;
};

export type AudioRenderClip = {
  assetId: string;
  uri: string;
  fromFrame: number;
  durationInFrames: number;
  trimStartSeconds: number;
  playbackRate: number;
  volumeEnvelope: AudioVolumeKeyframe[];
  role: "bgm" | "voiceover" | "sfx";
  loop: boolean;
};

export type AudioRenderPlan = {
  fps: number;
  clips: AudioRenderClip[];
};

export type BuildAudioRenderPlanInput = {
  runtime: NormalizedMotionProjectV2;
  fps: number;
  /** Composition duration used to clamp fades / loops. */
  durationInFrames: number;
  /**
   * Optional override rate per track id. Schema has no playbackRate yet —
   * defaults to 1.
   */
  playbackRateByTrackId?: Record<string, number>;
};

function resolveAssetUri(
  runtime: NormalizedMotionProjectV2,
  assetId: string,
): string | null {
  const asset = runtime.assets.find((entry) => entry.id === assetId);
  return asset?.uri ?? null;
}

function buildVolumeEnvelope(input: {
  startFrame: number;
  durationInFrames: number;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  fps: number;
}): AudioVolumeKeyframe[] {
  const { startFrame, durationInFrames, volume, fadeInSeconds, fadeOutSeconds, fps } =
    input;
  const safeVolume = Math.min(1, Math.max(0, volume));
  const fadeInFrames = Math.max(0, Math.round(fadeInSeconds * fps));
  const fadeOutFrames = Math.max(0, Math.round(fadeOutSeconds * fps));
  const endFrame = startFrame + Math.max(0, durationInFrames);

  const keys: AudioVolumeKeyframe[] = [];
  keys.push({ frame: startFrame, value: fadeInFrames > 0 ? 0 : safeVolume });
  if (fadeInFrames > 0) {
    keys.push({
      frame: Math.min(endFrame, startFrame + fadeInFrames),
      value: safeVolume,
    });
  }
  if (fadeOutFrames > 0 && endFrame > startFrame) {
    const fadeOutStart = Math.max(startFrame, endFrame - fadeOutFrames);
    if (fadeOutStart > startFrame + fadeInFrames) {
      keys.push({ frame: fadeOutStart, value: safeVolume });
    }
    keys.push({ frame: endFrame, value: 0 });
  } else {
    keys.push({ frame: endFrame, value: safeVolume });
  }
  return keys;
}

/**
 * Build a deterministic {@link AudioRenderPlan} from Runtime IR audio tracks.
 * Does not decode media — only timing / gain / trim / rate for adapters.
 */
export function buildAudioRenderPlan(
  input: BuildAudioRenderPlanInput,
): AudioRenderPlan {
  const fps = Math.max(1, input.fps);
  const clips: AudioRenderClip[] = [];

  for (const track of input.runtime.timeline.audioTracks) {
    const uri = resolveAssetUri(input.runtime, track.assetId);
    if (!uri) continue;

    const playbackRate = Math.max(
      0.01,
      input.playbackRateByTrackId?.[track.id] ?? 1,
    );
    const fromFrame = Math.max(0, Math.round(track.start * fps));
    const remainingFrames = Math.max(0, input.durationInFrames - fromFrame);
    // Without asset duration metadata, treat clip as filling remaining composition
    // (loop tracks still advertise full remaining window for the adapter).
    const durationInFrames = remainingFrames;
    if (durationInFrames <= 0) continue;

    clips.push({
      assetId: track.assetId,
      uri,
      fromFrame,
      durationInFrames,
      trimStartSeconds: track.trimStart ?? 0,
      playbackRate,
      volumeEnvelope: buildVolumeEnvelope({
        startFrame: fromFrame,
        durationInFrames,
        volume: track.volume ?? 1,
        fadeInSeconds: track.fadeIn ?? 0,
        fadeOutSeconds: track.fadeOut ?? 0,
        fps,
      }),
      role: track.role,
      loop: track.loop ?? false,
    });
  }

  return { fps, clips };
}

/** Sample volume envelope at a composition frame (step/hold between keys). */
export function sampleAudioVolumeAtFrame(
  envelope: AudioVolumeKeyframe[],
  frame: number,
): number {
  if (envelope.length === 0) return 0;
  let value = envelope[0]!.value;
  for (const key of envelope) {
    if (key.frame > frame) break;
    value = key.value;
  }
  return value;
}
