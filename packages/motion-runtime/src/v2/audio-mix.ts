import {
  deterministicTieBreak,
  secondsToSamples,
} from "../determinism";
import { validateRuntimeProjectV2 } from "./validate";
import type {
  RuntimeAudioClipV2,
  RuntimeAudioFadeV2,
  RuntimeAudioGainEnvelopeV2,
  RuntimeAudioMixInputV2,
  RuntimeAudioMixPlanV2,
  RuntimeAudioMixSegmentV2,
  RuntimeAudioProjectV2,
  RuntimeAudioTrackV2,
  RuntimeProjectV2,
} from "./types";

export type RuntimeAudioMixRangeV2 = {
  startSample: number;
  endSample: number;
};

type IndexedClip = {
  track: RuntimeAudioTrackV2;
  clip: RuntimeAudioClipV2;
  trackIndex: number;
  clipIndex: number;
};

function assertSampleRange(range: RuntimeAudioMixRangeV2): void {
  if (
    !Number.isSafeInteger(range.startSample) ||
    range.startSample < 0 ||
    !Number.isSafeInteger(range.endSample) ||
    range.endSample <= range.startSample
  ) {
    throw new Error("Audio mix range must use non-negative sample boundaries with end > start");
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Convert decibels into an amplitude multiplier without touching media data. */
export function gainDbToLinearV2(gainDb: number): number {
  if (!Number.isFinite(gainDb)) throw new Error("Audio gain must be finite");
  return Math.pow(10, gainDb / 20);
}

function fadeProgress(
  fade: RuntimeAudioFadeV2 | undefined,
  localStart: number,
  localEnd: number,
  direction: "in" | "out",
  clipDuration: number,
): { curve: RuntimeAudioFadeV2["curve"]; start: number; end: number } | undefined {
  if (!fade) return undefined;
  const fadeStart = direction === "in" ? 0 : clipDuration - fade.duration;
  const fadeEnd = direction === "in" ? fade.duration : clipDuration;
  if (localEnd <= fadeStart || localStart >= fadeEnd) return undefined;
  return {
    curve: fade.curve,
    start: clamp01((localStart - fadeStart) / fade.duration),
    end: clamp01((localEnd - fadeStart) / fade.duration),
  };
}

function envelopeForSegment(
  track: RuntimeAudioTrackV2,
  clip: RuntimeAudioClipV2,
  localStart: number,
  localEnd: number,
): RuntimeAudioGainEnvelopeV2 {
  return {
    baseGain: track.muted
      ? 0
      : gainDbToLinearV2(track.gainDb + clip.gainDb),
    ...(fadeProgress(clip.fadeIn, localStart, localEnd, "in", clip.timing.duration)
      ? { fadeIn: fadeProgress(clip.fadeIn, localStart, localEnd, "in", clip.timing.duration) }
      : {}),
    ...(fadeProgress(clip.fadeOut, localStart, localEnd, "out", clip.timing.duration)
      ? { fadeOut: fadeProgress(clip.fadeOut, localStart, localEnd, "out", clip.timing.duration) }
      : {}),
  };
}

function nextBoundarySample(
  clipStartSample: number,
  localSeconds: number,
  projectSampleRate: number,
  currentSample: number,
): number {
  return Math.max(
    currentSample + 1,
    clipStartSample + secondsToSamples(localSeconds, projectSampleRate),
  );
}

function buildSegments(
  track: RuntimeAudioTrackV2,
  clip: RuntimeAudioClipV2,
  projectSampleRate: number,
  overlapStart: number,
  overlapEnd: number,
): { sourceSampleRate: number; segments: RuntimeAudioMixSegmentV2[] } {
  const sourceSampleRate = clip.source.sampleRate ?? projectSampleRate;
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error(`Audio clip ${clip.id} has an invalid source sample rate`);
  }

  const clipStartSample = secondsToSamples(clip.timing.start, projectSampleRate);
  const trimStart = clip.trim.start;
  const trimEnd = clip.trim.end ?? clip.source.duration;
  const sourceSpan = trimEnd === undefined ? undefined : trimEnd - trimStart;
  if (clip.loop && (sourceSpan === undefined || sourceSpan <= 0)) {
    throw new Error(`Looped audio clip ${clip.id} requires a finite positive source span`);
  }

  const segments: RuntimeAudioMixSegmentV2[] = [];
  let current = overlapStart;
  while (current < overlapEnd) {
    const localStart = (current - clipStartSample) / projectSampleRate;
    let next = overlapEnd;
    let loopIndex = 0;
    let sourceStartSeconds = trimStart + localStart * clip.playbackRate;

    if (clip.loop) {
      const span = sourceSpan!;
      const sourceElapsed = Math.max(0, localStart * clip.playbackRate);
      loopIndex = Math.floor(sourceElapsed / span);
      const offset = sourceElapsed - loopIndex * span;
      sourceStartSeconds = trimStart + offset;
      const loopBoundary = ((loopIndex + 1) * span) / clip.playbackRate;
      next = Math.min(
        next,
        nextBoundarySample(clipStartSample, loopBoundary, projectSampleRate, current),
      );
    }

    for (const fadeBoundary of [
      clip.fadeIn?.duration,
      clip.fadeOut ? clip.timing.duration - clip.fadeOut.duration : undefined,
    ]) {
      if (fadeBoundary !== undefined && fadeBoundary > localStart) {
        next = Math.min(
          next,
          nextBoundarySample(clipStartSample, fadeBoundary, projectSampleRate, current),
        );
      }
    }

    const localEnd = Math.min(
      clip.timing.duration,
      (next - clipStartSample) / projectSampleRate,
    );
    const sourceEndSeconds = clip.loop
      ? Math.min(trimEnd!, sourceStartSeconds + (localEnd - localStart) * clip.playbackRate)
      : Math.min(
          trimEnd ?? Number.POSITIVE_INFINITY,
          trimStart + localEnd * clip.playbackRate,
        );
    const sourceStartSample = secondsToSamples(sourceStartSeconds, sourceSampleRate);
    const sourceEndSample = Math.max(
      sourceStartSample + 1,
      secondsToSamples(sourceEndSeconds, sourceSampleRate),
    );
    const segment: RuntimeAudioMixSegmentV2 = {
      compositionStartSample: current,
      compositionEndSample: next,
      sourceStartSample,
      sourceEndSample,
      loopIndex,
      gainEnvelope: envelopeForSegment(track, clip, localStart, localEnd),
    };
    segments.push(segment);
    current = next;
  }

  return { sourceSampleRate, segments };
}

function compareIndexedClips(left: IndexedClip, right: IndexedClip): number {
  return left.trackIndex - right.trackIndex ||
    left.clipIndex - right.clipIndex ||
    deterministicTieBreak(left.clip.id, right.clip.id);
}

function runtimeAudioOrSilence(runtime: RuntimeProjectV2): RuntimeAudioProjectV2 {
  return runtime.audio ?? { sampleRate: 48000, tracks: [] };
}

/**
 * Evaluate one deterministic half-open sample range into backend-neutral audio
 * inputs. No clock, decoder, browser API, or video frame state is consulted.
 */
export function evaluateRuntimeAudioMixV2(
  runtime: RuntimeProjectV2,
  range: RuntimeAudioMixRangeV2,
): RuntimeAudioMixPlanV2 {
  assertSampleRange(range);
  const validation = validateRuntimeProjectV2(runtime);
  if (!validation.ok) {
    throw new Error(
      `Runtime V2 validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" | ")}`,
    );
  }

  const audio = runtimeAudioOrSilence(runtime);
  const indexedClips: IndexedClip[] = [];
  audio.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip, clipIndex) => {
      indexedClips.push({ track, clip, trackIndex, clipIndex });
    });
  });
  indexedClips.sort(compareIndexedClips);

  const inputs: RuntimeAudioMixInputV2[] = [];
  for (const { track, clip } of indexedClips) {
    const clipStartSample = secondsToSamples(clip.timing.start, audio.sampleRate);
    const clipEndSample = secondsToSamples(
      clip.timing.start + clip.timing.duration,
      audio.sampleRate,
    );
    const compositionStartSample = Math.max(range.startSample, clipStartSample);
    const compositionEndSample = Math.min(range.endSample, clipEndSample);
    if (compositionEndSample <= compositionStartSample) continue;

    const lowered = buildSegments(
      track,
      clip,
      audio.sampleRate,
      compositionStartSample,
      compositionEndSample,
    );
    inputs.push({
      trackId: track.id,
      clipId: clip.id,
      assetId: clip.assetId,
      source: clip.source,
      sourceSampleRate: lowered.sourceSampleRate,
      pan: track.pan,
      muted: track.muted,
      compositionStartSample,
      compositionEndSample,
      segments: lowered.segments,
    });
  }

  return {
    sampleRate: audio.sampleRate,
    startSample: range.startSample,
    endSample: range.endSample,
    inputs,
  };
}
