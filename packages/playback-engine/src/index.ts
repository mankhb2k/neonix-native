/**
 * Playback Engine — transport, clock, scheduler, metrics.
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
