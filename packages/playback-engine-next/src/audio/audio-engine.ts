import {
  clipProgressAtCompositionSampleV3,
  envelopeGainAtClipProgressV3,
  sourceSampleAtCompositionSampleV3,
  stereoPanGainsV3,
  type RuntimeAudioMixPlanV3,
} from "@motionvideo/motion-runtime";
import type { AudioPlanSinkV3 } from "../core/types";
import type { PcmChunkV3 } from "./pcm-window";

/** Backend-neutral audio engine seam. Audio decoding/mixing is intentionally injected. */
export type AudioEngineV3 = AudioPlanSinkV3 & { start?(): void; stop?(): void; flush?(): void };

export type AudioMixSourceV3 = ReadonlyMap<string, readonly PcmChunkV3[]>;
export const audioSourceKeyV3 = (source: { mediaId: string; streamId: string }) => `${source.mediaId}:${source.streamId}`;

/** Deterministic stereo mixer used by BufferSource and Worklet adapters alike. */
export function mixAudioPlanV3(plan: RuntimeAudioMixPlanV3, sources: AudioMixSourceV3): Float32Array {
  const output = new Float32Array(Math.max(0, plan.endSample - plan.startSample) * 2);
  for (const input of plan.inputs) {
    if (input.muted) continue;
    const chunks = sources.get(audioSourceKeyV3(input.source)) ?? [];
    for (const segment of input.segments) {
      const from = Math.max(plan.startSample, segment.compositionStartSample);
      const to = Math.min(plan.endSample, segment.compositionEndSample);
      for (let sample = from; sample < to; sample++) {
        const sourceSample = sourceSampleAtCompositionSampleV3(segment, sample);
        const chunk = chunks.find((candidate) => sourceSample >= candidate.startSample && sourceSample < candidate.startSample + candidate.frames);
        if (!chunk) continue;
        const local = (sourceSample - chunk.startSample) * chunk.channels;
        const left = chunk.data[local] ?? 0;
        const right = chunk.channels > 1 ? chunk.data[local + 1] ?? left : left;
        const fade = envelopeGainAtClipProgressV3(
          segment.gainEnvelope,
          clipProgressAtCompositionSampleV3(segment, sample),
        );
        const pan = stereoPanGainsV3(input.pan);
        const out = (sample - plan.startSample) * 2;
        output[out] = (output[out] ?? 0) + left * input.gainLinear * fade * pan.left;
        output[out + 1] = (output[out + 1] ?? 0) + right * input.gainLinear * fade * pan.right;
      }
    }
  }
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-1, Math.min(1, output[i] ?? 0));
  return output;
}
