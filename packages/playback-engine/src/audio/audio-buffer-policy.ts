export type AudioBufferPolicyV3 = {
  readonly targetAheadSamples: number;
  readonly lowWatermarkSamples: number;
};

export function createAudioBufferPolicyV3(targetAheadSamples = 96_000, lowWatermarkSamples = targetAheadSamples / 2): AudioBufferPolicyV3 {
  return { targetAheadSamples, lowWatermarkSamples };
}
