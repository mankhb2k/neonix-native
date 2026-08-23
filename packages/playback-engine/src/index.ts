/**
 * V2-only playback transport. No compiler, authoring schema, or renderer
 * backend is owned by this package.
 */

export {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackClockOptions,
  type PlaybackClockState,
} from "./playback-clock";

export {
  createQualityController,
  type QualityController,
  type QualityMode,
  type QualityState,
} from "./quality";

export {
  createPlaybackMetrics,
  type PlaybackMetrics,
  type PlaybackMetricsSnapshot,
} from "./metrics";

export {
  createMediaFrameProvider,
  type MediaFrameProvider,
  type MediaFrameProviderOptions,
  type MediaTextureHandle,
} from "./media-frame-provider";

export {
  createFrameBuffer,
  releaseBufferedFrameData,
  type FrameBuffer,
  type FrameBufferEntry,
  type FrameBufferOptions,
  type BufferStatus,
} from "./frame-buffer";

export {
  createBufferPolicy,
  type BufferPolicy,
  type BufferPolicyMode,
  type BufferPolicyConfig,
  type BufferPolicyState,
} from "./buffer-policy";

export {
  createMediaFallbackBridge,
  type MediaFallbackBridge,
  type VideoFrameProvider,
} from "./media-fallback";

export {
  createPlaybackEngineV2,
  type PlaybackEngineV2,
  type PlaybackV2Consumer,
  type PlaybackAudioPlanContextV2,
  type PlaybackAudioSchedulingPolicyV2,
  type PlaybackEngineV2Options,
  type PlaybackV2Output,
  type PlaybackV2Scheduler,
} from "./playback-engine-v2";

export {
  createWebAudioAdapterV2,
  type WebAudioAdapterV2,
  type WebAudioAdapterV2Options,
  type WebAudioBufferSourceV2,
  type WebAudioBufferV2,
  type WebAudioContextV2,
  type WebAudioDiagnosticCodeV2,
  type WebAudioDiagnosticV2,
  type WebAudioGainNodeV2,
  type WebAudioNodeV2,
  type WebAudioOfflineContextV2,
  type WebAudioPannerNodeV2,
  type WebAudioParamV2,
} from "./web-audio-adapter-v2";

export {
  type ClockDrive,
  type PresentMode,
  type PreviewWorkerPort,
} from "./preview-worker-port";
