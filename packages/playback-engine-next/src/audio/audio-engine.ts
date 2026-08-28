import type { RuntimeAudioMixPlanV3 } from "@motionvideo/motion-runtime";
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
        const progress = (sample - segment.compositionStartSample) / Math.max(1, segment.compositionEndSample - segment.compositionStartSample);
        const sourceSample = Math.floor(segment.sourceStartSample + progress * (segment.sourceEndSample - segment.sourceStartSample));
        const chunk = chunks.find((candidate) => sourceSample >= candidate.startSample && sourceSample < candidate.startSample + candidate.frames);
        if (!chunk) continue;
        const local = (sourceSample - chunk.startSample) * chunk.channels;
        const left = chunk.data[local] ?? 0;
        const right = chunk.channels > 1 ? chunk.data[local + 1] ?? left : left;
        const fade = envelopeGainV3(segment.gainEnvelope, progress);
        const pan = Math.max(-1, Math.min(1, input.pan));
        const leftPan = pan <= 0 ? 1 : 1 - pan;
        const rightPan = pan >= 0 ? 1 : 1 + pan;
        const out = (sample - plan.startSample) * 2;
        output[out] = (output[out] ?? 0) + left * input.gainLinear * fade * leftPan;
        output[out + 1] = (output[out + 1] ?? 0) + right * input.gainLinear * fade * rightPan;
      }
    }
  }
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-1, Math.min(1, output[i] ?? 0));
  return output;
}

function envelopeGainV3(envelope: { baseGain: number; fadeIn?: { start: number; end: number; curve: string }; fadeOut?: { start: number; end: number; curve: string } }, progress: number): number {
  let gain = envelope.baseGain;
  if (envelope.fadeIn && progress < envelope.fadeIn.end) gain *= curveV3((progress - envelope.fadeIn.start) / Math.max(1e-9, envelope.fadeIn.end - envelope.fadeIn.start), envelope.fadeIn.curve);
  if (envelope.fadeOut && progress >= envelope.fadeOut.start) gain *= curveV3((envelope.fadeOut.end - progress) / Math.max(1e-9, envelope.fadeOut.end - envelope.fadeOut.start), envelope.fadeOut.curve);
  return Math.max(0, gain);
}
function curveV3(value: number, curve: string): number { const t = Math.max(0, Math.min(1, value)); return curve === "equal-power" ? Math.sin(t * Math.PI / 2) : t; }
