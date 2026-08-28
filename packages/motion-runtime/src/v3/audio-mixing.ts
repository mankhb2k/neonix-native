import type { RuntimeAudioGainEnvelopeV3, RuntimeAudioMixSegmentV3 } from "./types";

export const COMPOSITION_SAMPLE_RATE_V3 = 48_000 as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

/** Maps a composition sample to its source sample using a resolved segment. */
export function sourceSampleAtCompositionSampleV3(
  segment: RuntimeAudioMixSegmentV3,
  compositionSample: number,
): number {
  const progress = clamp(
    (compositionSample - segment.compositionStartSample) /
      Math.max(1, segment.compositionEndSample - segment.compositionStartSample),
    0,
    1,
  );
  return Math.floor(
    segment.sourceStartSample +
      progress * (segment.sourceEndSample - segment.sourceStartSample),
  );
}

/** Fade position is relative to the full clip, never the current PCM window. */
export function clipProgressAtCompositionSampleV3(
  segment: RuntimeAudioMixSegmentV3,
  compositionSample: number,
): number {
  return clamp(
    (compositionSample - segment.clipTimelineStartSample) /
      Math.max(1, segment.clipTimelineDurationSamples),
    0,
    1,
  );
}

export function envelopeGainAtClipProgressV3(
  envelope: RuntimeAudioGainEnvelopeV3,
  progress: number,
): number {
  let gain = envelope.baseGain;
  if (envelope.fadeIn && progress < envelope.fadeIn.end) {
    gain *= curveGain(
      (progress - envelope.fadeIn.start) /
        Math.max(1e-9, envelope.fadeIn.end - envelope.fadeIn.start),
      envelope.fadeIn.curve,
    );
  }
  if (envelope.fadeOut && progress >= envelope.fadeOut.start) {
    gain *= curveGain(
      (envelope.fadeOut.end - progress) /
        Math.max(1e-9, envelope.fadeOut.end - envelope.fadeOut.start),
      envelope.fadeOut.curve,
    );
  }
  return Math.max(0, gain);
}

export function stereoPanGainsV3(pan: number): { left: number; right: number } {
  const normalized = clamp(pan, -1, 1);
  return {
    left: normalized <= 0 ? 1 : 1 - normalized,
    right: normalized >= 0 ? 1 : 1 + normalized,
  };
}

function curveGain(value: number, curve: "linear" | "equal-power"): number {
  const normalized = clamp(value, 0, 1);
  return curve === "equal-power"
    ? Math.sin((normalized * Math.PI) / 2)
    : normalized;
}
