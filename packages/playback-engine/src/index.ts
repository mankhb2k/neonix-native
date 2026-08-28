/**
 * V2-only playback transport. No compiler, authoring schema, or renderer
 * backend is owned by this package.
 */

export {
  createBoundedHistory,
  type BoundedHistory,
} from "./bounded-history";

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
  createMediaFallbackBridge,
  type MediaFallbackBridge,
  type VideoFrameProvider,
} from "./media-fallback";

export {
  createPlaybackEngineV2,
  type PlaybackEngineV2,
  type PlaybackV2Consumer,
  type PlaybackFrameContextV2,
  type PlaybackAudioPlanContextV2,
  type PlaybackAudioSchedulingPolicyV2,
  type PlaybackEngineV2Options,
  type PlaybackPerformanceV2,
  type PlaybackPerformanceSampleV2,
  type PlaybackV2Output,
  type PlaybackV2Snapshot,
  type PlaybackV2Scheduler,
} from "./playback-engine-v2";

export {
  createDOMMediaControllerV2,
  createVideoMediaSession,
  type PlaybackMediaCommandV2,
  type PlaybackMediaControllerV2,
  type PlaybackMediaStatsV2,
  type PlaybackMediaSyncContextV2,
  type DOMMediaControllerV2Options,
  type VideoMediaSession,
  type VideoMediaSessionContext,
  type VideoMediaSessionOptions,
  type VideoMediaSessionStats,
} from "./media-controller-v2";
export {
  decideVideoPreload,
  type VideoPreloadDecision,
  type VideoPreloadPolicyInput,
} from "./video-preload-policy";

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
  type WebAudioResourceStatsV2,
} from "./web-audio-adapter-v2";

export {
  createAudioBufferCacheV2,
  type AudioBufferCacheV2,
  type AudioBufferCacheStatsV2,
  type AudioBufferCacheV2Options,
  type AudioBufferLikeV2,
} from "./audio-buffer-cache-v2";

export {
  audioSourceCacheKey,
  hasAudioDerivative,
  resolveAudioSourceUri,
} from "./audio-source-resolver";

export {
  type ClockDrive,
  type PresentMode,
  type PreviewWorkerPort,
} from "./preview-worker-port";

export {
  createRollingPcmBufferV2,
  type PcmChunkV2,
  type RollingPcmBufferV2,
  type RollingPcmBufferOptionsV2,
  type RollingPcmBufferStatsV2,
} from "./rolling-pcm-buffer";

export {
  createAudioStreamingSessionV2,
  type AudioDecodeRangeV2,
  type AudioSegmentDecoderV2,
  type AudioStreamingSessionV2,
} from "./audio-streaming";

export {
  createAudioWorkletMixerV2,
  type AudioWorkletContextV2,
  type AudioWorkletMixerChunkV2,
  type AudioWorkletMixerOptionsV2,
  type AudioWorkletMixerV2,
  type AudioWorkletNodeV2,
  type AudioWorkletPortV2,
} from "./audio-worklet-mixer";

export {
  chooseVideoBackendV2,
  createVideoFrameQueueV2,
  createWebCodecsVideoDecoderV2,
  type VideoBackendV2,
  type VideoFrameQueueOptionsV2,
  type VideoFrameQueueStatsV2,
  type VideoFrameQueueV2,
  type VideoFrameV2,
  type WebCodecsVideoDecoderV2,
} from "./video-codecs-provider";
