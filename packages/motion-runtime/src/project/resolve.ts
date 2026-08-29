import { COMPOSITION_SAMPLE_RATE_V3 } from "../audio/audio-mixing";
import type { AudioSampleRangeV3, RuntimeAudioClipV3, RuntimeAudioGainEnvelopeV3, RuntimeAudioMixPlanV3, RuntimeAudioMixSegmentV3, RuntimeMediaAudioStreamV3, RuntimeProjectV3, VideoRenderPlanV3 } from "./types";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const stream = (r: RuntimeProjectV3, s: { mediaId: string; streamId: string }) => r.mediaCatalog.assets.find(a => a.mediaId === s.mediaId)?.audio?.find(x => x.streamId === s.streamId);
export function resolveVideoAt(runtime: RuntimeProjectV3, timelineTimeUs: number): VideoRenderPlanV3 { return { timelineTimeUs, framePolicy: "floor", instances: runtime.videoTimeline.instances.filter(i => timelineTimeUs >= i.timelineStartUs && timelineTimeUs < i.timelineStartUs + i.timelineDurationUs).map(i => { const local = timelineTimeUs - i.timelineStartUs; const span = (i.sourceEndUs ?? runtime.mediaCatalog.assets.find(a => a.mediaId === i.source.mediaId)?.video?.find(s => s.streamId === i.source.streamId)?.durationUs ?? Infinity) - i.sourceStartUs; const offset = Number.isFinite(span) ? Math.min(Math.max(0, local * i.playbackRate), Math.max(0, span)) : Math.max(0, local * i.playbackRate); return { instanceId: i.instanceId, nodeId: i.nodeId, source: i.source, mediaTimeUs: i.sourceStartUs + offset, framePolicy: i.framePolicy }; }) }; }
export class RuntimeAudioResolutionError extends Error {
  constructor(
    readonly code: "MISSING_AUDIO_STREAM",
    message: string,
  ) {
    super(message);
    this.name = "RuntimeAudioResolutionError";
  }
}

export function resolveAudioWindow(runtime: RuntimeProjectV3, range: AudioSampleRangeV3): RuntimeAudioMixPlanV3 {
  const startSample = Math.max(0, Math.floor(range.startSample));
  const frameCount = Math.max(0, Math.floor(range.frameCount));
  const endSample = startSample + frameCount;
  const inputs: RuntimeAudioMixPlanV3["inputs"] = [];

  for (const track of runtime.audioTimeline.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.timelineStartSample + clip.timelineDurationSamples;
      const compositionStart = Math.max(startSample, clip.timelineStartSample);
      const compositionEnd = Math.min(endSample, clipEnd);
      const source = stream(runtime, clip.source);
      if (compositionEnd <= compositionStart) continue;
      if (!source) {
        throw new RuntimeAudioResolutionError(
          "MISSING_AUDIO_STREAM",
          `Audio stream '${clip.source.streamId}' was not found for '${clip.source.mediaId}'.`,
        );
      }
      const resolvedSegments = segments(clip, compositionStart, compositionEnd, source);
      if (resolvedSegments.length === 0) continue;
      inputs.push({
        trackId: track.trackId,
        clipId: clip.clipId,
        source: clip.source,
        sourceSampleRate: source.sampleRate,
        channels: source.channels,
        gainLinear: track.gainLinear * clip.gainLinear,
        pan: clamp(track.pan + clip.pan, -1, 1),
        muted: track.muted || clip.muted,
        compositionStartSample: resolvedSegments[0]!.compositionStartSample,
        compositionEndSample: resolvedSegments.at(-1)!.compositionEndSample,
        segments: resolvedSegments,
      });
    }
  }
  return { sampleRate: COMPOSITION_SAMPLE_RATE_V3, startSample, endSample, inputs };
}

function segments(
  clip: RuntimeAudioClipV3,
  start: number,
  end: number,
  source: RuntimeMediaAudioStreamV3,
): RuntimeAudioMixSegmentV3[] {
  const samplesPerCompositionSample =
    (clip.playbackRate * source.sampleRate) / COMPOSITION_SAMPLE_RATE_V3;
  const sourceLimit = Math.min(
    clip.sourceEndSample ?? source.durationSamples,
    source.durationSamples,
  );
  if (samplesPerCompositionSample <= 0 || sourceLimit <= clip.sourceStartSample) {
    return [];
  }

  const maxCompositionEnd = clip.timelineStartSample + Math.ceil(
    (sourceLimit - clip.sourceStartSample) / samplesPerCompositionSample,
  );
  const compositionEnd = Math.min(end, maxCompositionEnd);
  if (compositionEnd <= start) return [];

  const sourceAt = (compositionSample: number): number =>
    clip.sourceStartSample +
    Math.max(0, compositionSample - clip.timelineStartSample) *
      samplesPerCompositionSample;

  return [{
    compositionStartSample: start,
    compositionEndSample: compositionEnd,
    clipTimelineStartSample: clip.timelineStartSample,
    clipTimelineDurationSamples: clip.timelineDurationSamples,
    sourceStartSample: sourceAt(start),
    sourceEndSample: Math.min(sourceLimit, sourceAt(compositionEnd)),
    gainEnvelope: envelope(clip),
  }];
}
function envelope(c: RuntimeAudioClipV3): RuntimeAudioGainEnvelopeV3 { const e: RuntimeAudioGainEnvelopeV3 = { baseGain: 1 }; if (c.fadeIn && c.fadeIn.durationSamples > 0) e.fadeIn = { curve: c.fadeIn.curve, start: 0, end: clamp(c.fadeIn.durationSamples / c.timelineDurationSamples, 0, 1) }; if (c.fadeOut && c.fadeOut.durationSamples > 0) e.fadeOut = { curve: c.fadeOut.curve, start: clamp(1 - c.fadeOut.durationSamples / c.timelineDurationSamples, 0, 1), end: 1 }; return e; }
