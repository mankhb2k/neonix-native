/**
 * AudioRenderPlan — shared audio timing for Pixi Web Audio and Remotion adapters.
 *
 * §Phase 7 Tasks 7.1, 7.3 in core-engine-tasks.md
 */

import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-protocol";

export type AudioVolumeKeyframe = {
  frame: number;
  value: number;
};

/** Channel routing policy for audio adapters. */
export type AudioChannelPolicy = "stereo" | "mono" | "left-only" | "right-only";

export type AudioRenderClip = {
  assetId: string;
  uri: string;
  fromFrame: number;
  durationInFrames: number;
  trimStartSeconds: number;
  /** Trim end offset in seconds from asset start. */
  trimEndSeconds: number;
  /** Total duration of the source asset in seconds. */
  assetDurationSeconds: number;
  playbackRate: number;
  volumeEnvelope: AudioVolumeKeyframe[];
  role: "bgm" | "voiceover" | "sfx";
  loop: boolean;
  /** Optional loop window (start/end in source seconds). */
  loopWindowStartSeconds?: number;
  loopWindowEndSeconds?: number;
  /** Channel routing policy. Default: "stereo". */
  channelPolicy: AudioChannelPolicy;
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

/** Resolved asset metadata from the runtime asset registry. */
type ResolvedAsset = {
  uri: string;
  duration: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
};

function resolveAsset(
  runtime: NormalizedMotionProjectV2,
  assetId: string,
): ResolvedAsset | null {
  const asset = runtime.assets.find(
    (entry) => entry.id === assetId && entry.assetType === "audio",
  );
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    duration: (asset as { duration?: number }).duration ?? 0,
    sampleRate: (asset as { sampleRate?: number }).sampleRate,
    channels: (asset as { channels?: number }).channels,
    codec: (asset as { codec?: string }).codec,
  };
}

function buildVolumeEnvelope(input: {
  startFrame: number;
  durationInFrames: number;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  fps: number;
}): AudioVolumeKeyframe[] {
  const {
    startFrame,
    durationInFrames,
    volume,
    fadeInSeconds,
    fadeOutSeconds,
    fps,
  } = input;
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
    const asset = resolveAsset(input.runtime, track.assetId);
    if (!asset) continue;

    const playbackRate = Math.max(
      0.01,
      input.playbackRateByTrackId?.[track.id] ?? 1,
    );
    const fromFrame = Math.max(0, Math.round(track.start * fps));
    const remainingFrames = Math.max(0, input.durationInFrames - fromFrame);

    // Compute duration from resolved asset: clip duration capped by asset
    // duration (accounting for trim) and composition remaining time.
    const assetDurationFrames =
      asset.duration > 0
        ? Math.round((asset.duration / playbackRate) * fps)
        : remainingFrames;
    const durationInFrames = Math.min(remainingFrames, assetDurationFrames);
    if (durationInFrames <= 0) continue;

    // Resolve channel policy from track or default to stereo
    const channelPolicy: AudioChannelPolicy =
      (track as { channelPolicy?: AudioChannelPolicy }).channelPolicy ??
      "stereo";

    // Resolve loop window from track (if loop is enabled)
    const loopWindowStart = (track as { loopWindowStart?: number })
      .loopWindowStart;
    const loopWindowEnd = (track as { loopWindowEnd?: number }).loopWindowEnd;

    clips.push({
      assetId: track.assetId,
      uri: asset.uri,
      fromFrame,
      durationInFrames,
      trimStartSeconds: track.trimStart ?? 0,
      trimEndSeconds: (track as { trimEnd?: number }).trimEnd ?? asset.duration,
      assetDurationSeconds: asset.duration,
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
      loopWindowStartSeconds: loopWindowStart,
      loopWindowEndSeconds: loopWindowEnd,
      channelPolicy,
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

/**
 * Sample volume envelope at a composition frame with linear interpolation
 * between adjacent keyframes.
 *
 * §Phase 7 Task 7.3: Continuous fade, not step/hold.
 */
export function sampleAudioVolumeLinear(
  envelope: AudioVolumeKeyframe[],
  frame: number,
): number {
  if (envelope.length === 0) return 0;
  if (envelope.length === 1) return envelope[0]!.value;

  // Find the segment [i, i+1] that contains `frame`
  for (let i = 0; i < envelope.length - 1; i++) {
    const a = envelope[i]!;
    const b = envelope[i + 1]!;

    if (frame < a.frame) continue;
    if (frame >= b.frame) continue;

    // Linear interpolation between a and b
    const span = b.frame - a.frame;
    if (span <= 0) return b.value;
    const t = (frame - a.frame) / span;
    return a.value + (b.value - a.value) * t;
  }

  // After last keyframe: clamp to last value
  if (frame >= envelope[envelope.length - 1]!.frame) {
    return envelope[envelope.length - 1]!.value;
  }

  // Before first keyframe: clamp to first value
  return envelope[0]!.value;
}
