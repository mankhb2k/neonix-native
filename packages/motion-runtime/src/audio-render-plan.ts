/**
 * AudioRenderPlan — shared audio timing for Pixi Web Audio and Remotion adapters.
 *
 * Per-clip fadeIn/fadeOut are DSP envelopes on that clip only — never inferred
 * crossfades between neighboring clips.
 */

import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

export type AudioVolumeKeyframe = {
  frame: number;
  value: number;
};

/** Channel routing policy for audio adapters. */
export type AudioChannelPolicy = "stereo" | "mono" | "left-only" | "right-only";

export type AudioRenderClip = {
  /** Runtime audio track id + clip id (stable identity). */
  trackId: string;
  clipId: string;
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
  loop: boolean;
  muted: boolean;
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
  runtime: MotionRuntimeProject;
  fps: number;
  /** Composition duration (frames); used only for fade clamp context. */
  durationInFrames: number;
  /**
   * Optional override rate per clip id (tests / debug). Defaults to the
   * clip's own `playbackRate`.
   */
  playbackRateByClipId?: Record<string, number>;
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
  runtime: MotionRuntimeProject,
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
 * Overlapping clips (same or different tracks) each get their own envelope
 * and are mixed by the adapter.
 */
export function buildAudioRenderPlan(
  input: BuildAudioRenderPlanInput,
): AudioRenderPlan {
  const fps = Math.max(1, input.fps);
  const clips: AudioRenderClip[] = [];

  for (const track of input.runtime.timeline.audioTracks) {
    const trackMuted = track.muted ?? false;
    for (const clip of track.clips) {
      const asset = resolveAsset(input.runtime, clip.assetId);
      if (!asset) continue;

      const playbackRate = Math.max(
        0.01,
        input.playbackRateByClipId?.[clip.id] ?? clip.playbackRate ?? 1,
      );
      const fromFrame = Math.max(0, Math.round(clip.start * fps));
      const durationInFrames = Math.max(0, Math.round(clip.duration * fps));
      if (durationInFrames <= 0) continue;

      const muted = trackMuted || (clip.muted ?? false);
      const volume = muted ? 0 : (clip.volume ?? 1);

      const channelPolicy: AudioChannelPolicy =
        (clip as { channelPolicy?: AudioChannelPolicy }).channelPolicy ??
        "stereo";

      const loopWindowStart = (clip as { loopWindowStart?: number })
        .loopWindowStart;
      const loopWindowEnd = (clip as { loopWindowEnd?: number }).loopWindowEnd;

      clips.push({
        trackId: track.id,
        clipId: clip.id,
        assetId: clip.assetId,
        uri: asset.uri,
        fromFrame,
        durationInFrames,
        trimStartSeconds: clip.trimStart ?? 0,
        trimEndSeconds: clip.trimEnd ?? asset.duration,
        assetDurationSeconds: asset.duration,
        playbackRate,
        volumeEnvelope: buildVolumeEnvelope({
          startFrame: fromFrame,
          durationInFrames,
          volume,
          fadeInSeconds: muted ? 0 : (clip.fadeIn ?? 0),
          fadeOutSeconds: muted ? 0 : (clip.fadeOut ?? 0),
          fps,
        }),
        loop: clip.loop ?? false,
        muted,
        loopWindowStartSeconds: loopWindowStart,
        loopWindowEndSeconds: loopWindowEnd,
        channelPolicy,
      });
    }
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
