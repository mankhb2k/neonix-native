/**
 * PlaybackClock — the unified time substrate for the playback engine.
 *
 * §Phase 6 Task 6.2 in core-engine-tasks.md
 *
 * Two clock sources:
 *   1. AudioContext.currentTime — when audio is available and not suspended.
 *      This is the preferred clock because it's hardware-backed and
 *      avoids drift between video and audio.
 *   2. Monotonic fallback — performance.now() when no AudioContext or
 *      when audio is suspended.
 *
 * The clock re-anchors on: play, seek, rate change, visibility change.
 * It provides a single `currentTime()` function that returns consistent
 * composition time regardless of which substrate is active.
 */

export type PlaybackClockState = {
  /** Current composition time in seconds (monotonically increasing during playback). */
  currentTime: number;
  /** Whether the clock is currently running. */
  running: boolean;
  /** Clock source: "audio" or "monotonic". */
  source: "audio" | "monotonic";
};

export type PlaybackClockOptions = {
  /** FPS for time quantization. */
  fps: number;
  /** Total composition duration in seconds. */
  duration: number;
  /** Optional AudioContext for hardware-backed timing. */
  audioContext?: AudioContext | null;
  /**
   * Monotonic time source (injectable for testing).
   * Default: performance.now() / 1000.
   */
  getMonotonicTime?: () => number;
};

export type PlaybackClock = {
  /** Get current clock state (non-mutating). */
  getState(): PlaybackClockState;

  /** Start or resume the clock. */
  play(): void;

  /** Pause the clock (freezes current time). */
  pause(): void;

  /** Seek to a specific time. Re-anchors if running. */
  seek(time: number): void;

  /** Set playback rate. Re-anchors if running. */
  setRate(rate: number): void;

  /** Notify the clock of visibility/resume events for re-anchoring. */
  reanchor(): void;

  /** Get current composition time in seconds. */
  currentTime(): number;

  /** Get the current composition frame index. */
  currentFrame(): number;

  /** Whether the clock is running. */
  isRunning(): boolean;

  /** Dispose the clock (no-op for monotonic, close AudioContext if owned). */
  dispose(): void;
};

export function createPlaybackClock(opts: PlaybackClockOptions): PlaybackClock {
  const fps = Math.max(1, opts.fps);
  const duration = opts.duration;
  const getMonotonic =
    opts.getMonotonicTime ?? (() => performance.now() / 1000);
  const audioCtx = opts.audioContext ?? null;

  let running = false;
  let playbackRate = 1;
  let frozenTime = 0;

  // Anchor point: when the clock started, what was the wall time and timeline time?
  let anchorWall = 0;
  let anchorTimeline = 0;
  let anchorRate = 1;

  // Detect audio context availability
  const getOrInitAudioTime = (): number | null => {
    if (!audioCtx) return null;
    if (audioCtx.state === "closed") return null;
    // suspended audio still returns currentTime but doesn't advance — we detect this
    return audioCtx.currentTime;
  };

  const reanchorInternal = (atTime?: number) => {
    const timeline = atTime ?? frozenTime;
    const wallNow = getMonotonic();

    // Prefer audio clock if available and running
    const audioWall = getOrInitAudioTime();
    if (audioWall !== null && audioCtx?.state === "running") {
      anchorWall = audioWall;
    } else {
      anchorWall = wallNow;
    }

    anchorTimeline = timeline;
    anchorRate = playbackRate;
  };

  const computeCurrent = (): number => {
    if (!running) return frozenTime;

    const audioWall =
      audioCtx?.state === "running" ? getOrInitAudioTime() : null;
    const wallNow = audioWall ?? getMonotonic();

    const elapsed = (wallNow - anchorWall) * anchorRate;
    const raw = anchorTimeline + elapsed;

    // Clamp to duration
    return Math.min(duration, Math.max(0, raw));
  };

  return {
    getState() {
      return {
        currentTime: computeCurrent(),
        running,
        source:
          audioCtx?.state === "running" && getOrInitAudioTime() !== null
            ? "audio"
            : "monotonic",
      };
    },

    play() {
      if (running) return;
      frozenTime = computeCurrent();
      running = true;
      reanchorInternal();
    },

    pause() {
      if (!running) return;
      frozenTime = computeCurrent();
      running = false;
    },

    seek(time: number) {
      frozenTime = Math.min(duration, Math.max(0, time));
      if (running) {
        reanchorInternal();
      }
    },

    setRate(rate: number) {
      frozenTime = computeCurrent();
      playbackRate = Math.max(0, rate);
      if (running) {
        reanchorInternal();
      }
    },

    reanchor() {
      frozenTime = computeCurrent();
      if (running) {
        reanchorInternal();
      }
    },

    currentTime() {
      return computeCurrent();
    },

    currentFrame() {
      return Math.floor(computeCurrent() * fps);
    },

    isRunning() {
      return running;
    },

    dispose() {
      running = false;
      // Don't close AudioContext — it's typically owned by the host
    },
  };
}
