/**
 * Playback Engine — transport, clock, scheduler, metrics, audio, media.
 *
 * Pure TypeScript package. No React, no DOM, no Pixi.
 * Consumed by web, desktop, and test harnesses.
 */

export {
  createPlaybackEngine,
  type PlaybackEngine,
  type PlaybackEngineOptions,
  type FrameConsumer,
} from "./playback-engine";

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
  createAudioScheduler,
  type AudioScheduler,
  type AudioSchedulerOptions,
  type AudioContextLike,
  type AudioBufferSourceNodeLike,
  type GainNodeLike,
  type AudioBufferLike,
} from "./audio-scheduler";

export {
  createMediaFrameProvider,
  type MediaFrameProvider,
  type MediaFrameProviderOptions,
  type MediaTextureHandle,
} from "./media-frame-provider";

export {
  createFrameBuffer,
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
