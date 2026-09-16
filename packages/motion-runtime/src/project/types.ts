import type {
  VisualRuntimeComposition,
  VisualRuntimeFrame,
  VisualRuntimeNode,
  VisualRuntimeView,
} from "../visual/types";

/**
 * Visual runtime primitives are intentionally unchanged by the V3 media
 * boundary. These aliases make that reuse explicit at the canonical V3 API
 * instead of forcing V3 consumers to import visual implementation details.
 */
export type RuntimeCompositionV3 = VisualRuntimeComposition;
export type RuntimeViewV3 = VisualRuntimeView;
export type RuntimeNodeV3 = VisualRuntimeNode;
export type RuntimeFrameV3 = Omit<VisualRuntimeFrame, "runtimeVersion"> & {
  runtimeVersion: 3;
};
export type RuntimeMediaResourceRoleV3 = "original" | "preview-proxy" | "video-proxy" | "audio-proxy" | "thumbnail";
export type RuntimeMediaResourceV3 = { resourceId: string; role: RuntimeMediaResourceRoleV3; uri: string; mimeType?: string; integrity?: string; byteSize?: number };
export type RuntimeMediaVideoStreamV3 = { streamId: string; resource: RuntimeMediaResourceV3; durationUs: number; width: number; height: number; frameRate: number; codec?: string };
export type RuntimeMediaAudioStreamV3 = { streamId: string; resource: RuntimeMediaResourceV3; durationSamples: number; sampleRate: number; channels: number; codec?: string };
export type RuntimeMediaAssetV3 = { mediaId: string; video?: RuntimeMediaVideoStreamV3[]; audio?: RuntimeMediaAudioStreamV3[]; poster?: RuntimeMediaResourceV3 };
export type RuntimeMediaCatalogV3 = { assets: RuntimeMediaAssetV3[] };
export type RuntimeMediaSourceRefV3 = { mediaId: string; streamId: string };
export type RuntimeVisualProjectV3 = { composition: RuntimeCompositionV3; view: RuntimeViewV3; nodes: RuntimeNodeV3[] };
/**
 * Discrete, compiler-baked visual state for one composition frame.
 *
 * Each entry contains only nodes that differ from `RuntimeProjectV3.visual`.
 * The runtime overlays these nodes by id before evaluating the frame. This
 * keeps Protocol V2 authoring data out of preview/export while preserving the
 * exact animation sample chosen by the canonical compiler.
 */
export type RuntimeVisualNodeDeltaV3 = { id: string } & Partial<Omit<RuntimeNodeV3, "id">>;
export type RuntimeVisualFrameDeltaV3 = { nodes: RuntimeVisualNodeDeltaV3[] };
export type RuntimeVisualTimelineV3 = {
  /** Must match the composition frame count: ceil(duration * fps). */
  frames: RuntimeVisualFrameDeltaV3[];
};
export type RuntimeVisualCompileStatsV3 = {
  staticNodeCount: number;
  animatedNodeCount: number;
  frameCount: number;
  totalDeltaNodeCount: number;
  averageDeltaNodesPerFrame: number;
  totalDeltaPayloadBytes: number;
  averageDeltaPayloadBytesPerFrame: number;
  optimizedFrameCount: number;
  fallbackFrameCount: number;
};
export type RuntimeVideoFramePolicyV3 = "floor" | "round" | "ceil";
export type RuntimeVideoInstanceV3 = { instanceId: string; nodeId: string; source: RuntimeMediaSourceRefV3; timelineStartUs: number; timelineDurationUs: number; sourceStartUs: number; sourceEndUs?: number; playbackRate: number; framePolicy: RuntimeVideoFramePolicyV3 };
export type RuntimeVideoTimelinePlanV3 = { instances: RuntimeVideoInstanceV3[] };
export type RuntimeAudioFadeCurveV3 = "linear" | "equal-power";
export type RuntimeAudioFadeV3 = { durationSamples: number; curve: RuntimeAudioFadeCurveV3 };
export type RuntimeAudioClipV3 = { clipId: string; trackId: string; source: RuntimeMediaSourceRefV3; timelineStartSample: number; timelineDurationSamples: number; sourceStartSample: number; sourceEndSample?: number; playbackRate: number; gainLinear: number; pan: number; muted: boolean; fadeIn?: RuntimeAudioFadeV3; fadeOut?: RuntimeAudioFadeV3; origin?: { kind: "video" | "standalone-audio"; authoringId: string } };
export type RuntimeAudioTrackPlanV3 = { trackId: string; gainLinear: number; pan: number; muted: boolean; clips: RuntimeAudioClipV3[] };
export type RuntimeAudioTimelinePlanV3 = { sampleRate: 48000; tracks: RuntimeAudioTrackPlanV3[] };
export type RuntimeAudioFadeProgressV3 = { curve: RuntimeAudioFadeCurveV3; start: number; end: number };
export type RuntimeAudioGainEnvelopeV3 = { baseGain: number; fadeIn?: RuntimeAudioFadeProgressV3; fadeOut?: RuntimeAudioFadeProgressV3 };
/**
 * A source range expressed in native source-sample units. Composition samples
 * always use the 48 kHz timeline domain, while source samples use
 * `RuntimeAudioMixInputV3.sourceSampleRate`.
 */
export type RuntimeAudioMixSegmentV3 = {
  compositionStartSample: number;
  compositionEndSample: number;
  clipTimelineStartSample: number;
  clipTimelineDurationSamples: number;
  sourceStartSample: number;
  sourceEndSample: number;
  gainEnvelope: RuntimeAudioGainEnvelopeV3;
};
export type RuntimeAudioMixInputV3 = { trackId: string; clipId: string; source: RuntimeMediaSourceRefV3; sourceSampleRate: number; channels: number; gainLinear: number; pan: number; muted: boolean; compositionStartSample: number; compositionEndSample: number; segments: RuntimeAudioMixSegmentV3[] };
export type RuntimeAudioMixPlanV3 = { sampleRate: 48000; startSample: number; endSample: number; inputs: RuntimeAudioMixInputV3[] };
export type VideoRenderPlanV3 = { timelineTimeUs: number; framePolicy: RuntimeVideoFramePolicyV3; instances: Array<{ instanceId: string; nodeId: string; source: RuntimeMediaSourceRefV3; mediaTimeUs: number; framePolicy: RuntimeVideoFramePolicyV3 }> };
export type RuntimeDiagnosticV3 = { severity: "error" | "warning"; code: string; message: string; path?: string };
export type RuntimeProjectV3 = { format: "motion-runtime"; runtimeVersion: 3; projectId: string; durationUs: number; visual: RuntimeVisualProjectV3; visualTimeline?: RuntimeVisualTimelineV3; compileStats?: RuntimeVisualCompileStatsV3; mediaCatalog: RuntimeMediaCatalogV3; videoTimeline: RuntimeVideoTimelinePlanV3; audioTimeline: RuntimeAudioTimelinePlanV3; diagnostics?: RuntimeDiagnosticV3[] };
export type RuntimeValidationV3 = { ok: boolean; diagnostics: RuntimeDiagnosticV3[] };
/** A bounded composition-sample request. `sampleRate` belongs to the runtime timeline. */
export type AudioSampleRangeV3 = { startSample: number; frameCount: number };
