/**
 * Performance metrics collector for the playback engine.
 *
 * §Phase 6 Task 6.6 in core-engine-tasks.md
 *
 * Tracks:
 *   - Starvation: ticks where no frame was produced (RAF fired but nothing to paint)
 *   - Dropped frames: frames produced but not painted (sequence mismatch)
 *   - Stale frames: old frames arriving after seek/patch
 *   - Evaluate time (ms): time spent in Runtime V2 frame evaluation
 *   - Paint time (ms): time spent in painter.paintCommands
 *   - Buffer size: number of buffered frames (future Phase 9)
 *
 * All times are wall-clock in milliseconds. Metrics are reset on dispose.
 */

export type PlaybackMetricsSnapshot = {
  /** Total number of ticks (RAF callbacks) processed. */
  totalTicks: number;
  /** Ticks where no new frame was evaluated (engine idle or starved). */
  starvedTicks: number;
  /** Frames dropped due to sequence ID mismatch (stale after seek/patch). */
  droppedFrames: number;
  /** Total frames evaluated. */
  evaluatedFrames: number;
  /** Cumulative evaluate time in milliseconds. */
  evaluateTimeMs: number;
  /** Cumulative paint time in milliseconds. */
  paintTimeMs: number;
  /** Latest evaluate time in ms (p95-like for live monitoring). */
  lastEvaluateTimeMs: number;
  /** Latest paint time in ms. */
  lastPaintTimeMs: number;
  /** Peak evaluate time in this session. */
  peakEvaluateTimeMs: number;
  /** Current buffered frame count (for future Phase 9). */
  bufferSize: number;
};

export type PlaybackMetrics = {
  /** Record a tick event (RAF fired). */
  tick(): void;

  /** Record a starved tick (no frame produced). */
  starved(): void;

  /** Record a frame drop (stale sequence). */
  dropped(): void;

  /** Record an evaluate + paint cycle. */
  recordFrame(evaluateMs: number, paintMs: number): void;

  /** Set current buffer size (for future worker mode). */
  setBufferSize(size: number): void;

  /** Get a snapshot of current metrics. */
  snapshot(): PlaybackMetricsSnapshot;

  /** Reset all counters. */
  reset(): void;
};

export function createPlaybackMetrics(): PlaybackMetrics {
  let totalTicks = 0;
  let starvedTicks = 0;
  let droppedFrames = 0;
  let evaluatedFrames = 0;
  let evaluateTimeMs = 0;
  let paintTimeMs = 0;
  let lastEvaluateTimeMs = 0;
  let lastPaintTimeMs = 0;
  let peakEvaluateTimeMs = 0;
  let bufferSize = 0;

  return {
    tick() {
      totalTicks += 1;
    },

    starved() {
      starvedTicks += 1;
    },

    dropped() {
      droppedFrames += 1;
    },

    recordFrame(evalMs: number, paintMs: number) {
      evaluatedFrames += 1;
      evaluateTimeMs += evalMs;
      paintTimeMs += paintMs;
      lastEvaluateTimeMs = evalMs;
      lastPaintTimeMs = paintMs;
      if (evalMs > peakEvaluateTimeMs) peakEvaluateTimeMs = evalMs;
    },

    setBufferSize(size: number) {
      bufferSize = size;
    },

    snapshot() {
      return {
        totalTicks,
        starvedTicks,
        droppedFrames,
        evaluatedFrames,
        evaluateTimeMs,
        paintTimeMs,
        lastEvaluateTimeMs,
        lastPaintTimeMs,
        peakEvaluateTimeMs,
        bufferSize,
      };
    },

    reset() {
      totalTicks = 0;
      starvedTicks = 0;
      droppedFrames = 0;
      evaluatedFrames = 0;
      evaluateTimeMs = 0;
      paintTimeMs = 0;
      lastEvaluateTimeMs = 0;
      lastPaintTimeMs = 0;
      peakEvaluateTimeMs = 0;
      bufferSize = 0;
    },
  };
}
