export type AudioEnvelopeSegmentV3 = { readonly start: number; readonly end: number; readonly gain: number; readonly curve?: "linear" | "equal-power" };
export type AudioWorkletCommandV3 =
  | { type: "reset"; generation: number; timelineStartSample: number }
  | { type: "configure-input"; generation: number; inputId: string; channels: number; pan: number }
  | { type: "push-pcm"; generation: number; inputId: string; timelineStartSample: number; channels: number; frames: number; data: Float32Array; envelope: readonly AudioEnvelopeSegmentV3[] }
  | { type: "remove-input"; generation: number; inputId: string }
  | { type: "pause"; generation: number }
  | { type: "start"; generation: number };
export type AudioWorkletMessageV3 = AudioWorkletCommandV3;
export type AudioWorkletTelemetryV3 = { type: "metrics"; generation: number; renderedSamples: number; underruns: number };
