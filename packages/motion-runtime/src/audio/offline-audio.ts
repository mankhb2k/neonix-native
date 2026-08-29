import type { RuntimeAudioMixPlanV3, RuntimeMediaSourceRefV3 } from "../project/types";
import {
  clipProgressAtCompositionSampleV3,
  envelopeGainAtClipProgressV3,
  sourceSampleAtCompositionSampleV3,
  stereoPanGainsV3,
} from "./audio-mixing";
export type OfflineAudioSourceV3 = { sampleRate: number; channels: number; samples: readonly number[] };
export function sourceKey(s: RuntimeMediaSourceRefV3) { return `${s.mediaId}:${s.streamId}`; }
export function evaluateAudioMixPlanV3(
  plan: RuntimeAudioMixPlanV3,
  sources: ReadonlyMap<string, OfflineAudioSourceV3>,
): Float32Array {
  const output = new Float32Array(Math.max(0, plan.endSample - plan.startSample) * 2);
  for (const input of plan.inputs) {
    if (input.muted) continue;
    const source = sources.get(sourceKey(input.source));
    if (!source) continue;
    const pan = stereoPanGainsV3(input.pan);
    for (const segment of input.segments) {
      for (
        let sample = Math.max(plan.startSample, segment.compositionStartSample);
        sample < Math.min(plan.endSample, segment.compositionEndSample);
        sample += 1
      ) {
        const sourceSample = sourceSampleAtCompositionSampleV3(segment, sample);
        const sourceOffset = sourceSample * source.channels;
        const clipProgress = clipProgressAtCompositionSampleV3(segment, sample);
        const gain = input.gainLinear * envelopeGainAtClipProgressV3(
          segment.gainEnvelope,
          clipProgress,
        );
        const left = source.samples[sourceOffset] ?? 0;
        const right = source.channels > 1
          ? source.samples[sourceOffset + 1] ?? left
          : left;
        const outputOffset = (sample - plan.startSample) * 2;
        output[outputOffset] += left * gain * pan.left;
        output[outputOffset + 1] += right * gain * pan.right;
      }
    }
  }
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.max(-1, Math.min(1, output[index] ?? 0));
  }
  return output;
}
