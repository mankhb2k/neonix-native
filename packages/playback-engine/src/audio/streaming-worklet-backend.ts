import type { AudioBackendV3 } from "./audio-backend";
import type { PlaybackOperationTokenV3 } from "../core/types";
import type { PcmChunkV3 } from "./pcm-window";
import type { AudioEnvelopeSegmentV3, AudioWorkletCommandV3, AudioWorkletTelemetryV3 } from "./worklet-protocol";

export type StreamingWorkletBackendOptionsV3 = { readonly port: { postMessage(message: unknown, transfer?: Transferable[]): void } };
export type StreamingWorkletBackendV3 = AudioBackendV3 & { reset(token: PlaybackOperationTokenV3, timelineStartSample?: number): void; push(inputId: string, chunk: PcmChunkV3, envelope?: readonly AudioEnvelopeSegmentV3[], token?: PlaybackOperationTokenV3): boolean; start(token: PlaybackOperationTokenV3): void; pause(token: PlaybackOperationTokenV3): void; updateTelemetry(message: AudioWorkletTelemetryV3): void; renderedSamples(): number; underruns(): number; telemetry(): { underruns: number } };
export function createStreamingWorkletBackendV3(options: StreamingWorkletBackendOptionsV3): StreamingWorkletBackendV3 {
  let generation = -1;
  let wantsPlay = false;
  let renderedSamples = 0;
  let underruns = 0;
  const post = (message: AudioWorkletCommandV3, transfer?: Transferable[]) => options.port.postMessage(message, transfer);
  return {
    publish(plan, token) { if (token.generation < generation) return; if (token.generation > generation) { generation = token.generation; post({ type: "reset", generation, timelineStartSample: plan.startSample }); if (wantsPlay) post({ type: "start", generation }); } },
    reset(token, timelineStartSample = 0) { if (token.generation < generation) return; generation = token.generation; renderedSamples = 0; underruns = 0; post({ type: "reset", generation, timelineStartSample }); },
    push(inputId, chunk, envelope = [], token) { const active = token?.generation ?? chunk.generation; if (active !== generation || chunk.generation !== generation) return false; const message: AudioWorkletCommandV3 = { type: "push-pcm", generation, inputId, timelineStartSample: chunk.startSample, channels: chunk.channels, frames: chunk.frames, data: chunk.data, envelope }; post(message, [chunk.data.buffer]); return true; },
    start(token) { wantsPlay = true; if (token.generation !== generation) return; post({ type: "start", generation }); },
    pause(token) { wantsPlay = false; if (token.generation !== generation) return; post({ type: "pause", generation }); },
    flush(token) { if (token.generation < generation) return; generation = token.generation; renderedSamples = 0; underruns = 0; post({ type: "reset", generation, timelineStartSample: 0 }); },
    updateTelemetry(message) { if (message.generation !== generation) return; renderedSamples = Math.max(renderedSamples, message.renderedSamples); underruns = Math.max(underruns, message.underruns); },
    renderedSamples: () => renderedSamples,
    underruns: () => underruns,
    telemetry: () => ({ underruns }),
    dispose() { if (generation >= 0) post({ type: "reset", generation, timelineStartSample: 0 }); generation = -1; wantsPlay = false; },
  };
}
