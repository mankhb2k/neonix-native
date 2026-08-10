/**
 * Buffer policy — controls the look-ahead buffering strategy for the
 * playback engine.
 *
 * §Phase 9 Task 9.3 in core-engine-tasks.md
 *
 * Policies:
 *   - **Playing (full)**: buffer ahead up to `targetSec` with max inflight.
 *     Starvation fallback: skip to next expected frame.
 *   - **Interactive (drag/scrub)**: zero buffer ahead, max 1 inflight.
 *     Responsive to seek with minimal latency.
 *   - **Paused (final refine)**: drain buffer, produce one final-quality
 *     frame after the engine stops.
 */

export type BufferPolicyMode = "playing" | "interactive" | "paused";

export type BufferPolicyConfig = {
  /** Target buffer ahead in seconds when playing. */
  targetSec: number;
  /** Maximum concurrently in-flight produce requests. */
  maxInflight: number;
  /** Frames per second for capacity calculations. */
  fps: number;
};

const DEFAULT_CONFIG: BufferPolicyConfig = {
  targetSec: 3.0,
  maxInflight: 4,
  fps: 30,
};

export type BufferPolicyState = {
  mode: BufferPolicyMode;
  /** Effective target buffer seconds based on current mode. */
  effectiveTargetSec: number;
  /** Effective max inflight based on current mode. */
  effectiveMaxInflight: number;
  /** Whether a final refine frame is requested after pause. */
  refineRequested: boolean;
  /** Whether the buffer is currently starved. */
  starved: boolean;
  /** Number of consecutive starved ticks. */
  starvationCounter: number;
};

export type BufferPolicy = {
  /** Set the current mode. */
  setMode(mode: BufferPolicyMode): void;

  /** Get the current mode. */
  getMode(): BufferPolicyMode;

  /**
   * Determine the buffer capacity in frames for the given FPS.
   */
  getBufferCapacity(): number;

  /**
   * Whether the engine should request more frames from the producer.
   * Returns true when aheadSec < effectiveTargetSec AND inflight < effectiveMaxInflight.
   */
  shouldTopUp(aheadSec: number, inflightCount: number): boolean;

  /**
   * Record a starvation event. Returns true if the policy decides to
   * trigger a fallback (e.g., skip to next frame).
   */
  recordStarvation(): boolean;

  /**
   * Reset the starvation counter.
   */
  resetStarvation(): void;

  /**
   * After pause, check if a final refine frame should be produced.
   * Consumes the flag (returns true once).
   */
  consumeRefine(): boolean;

  /** Current state snapshot. */
  getState(): BufferPolicyState;

  /** Reset to defaults. */
  reset(): void;
};

export function createBufferPolicy(
  config?: Partial<BufferPolicyConfig>,
): BufferPolicy {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const fps = Math.max(1, cfg.fps);

  let mode: BufferPolicyMode = "playing";
  let refineRequested = false;
  let starvationCounter = 0;
  const MAX_STARVATION_BEFORE_FALLBACK = 5;

  function setMode(next: BufferPolicyMode): void {
    const prev = mode;
    mode = next;

    // When transitioning to paused, flag a refine
    if (prev === "playing" && next === "paused") {
      refineRequested = true;
    }

    // Reset starvation on mode change
    starvationCounter = 0;
  }

  function getMode(): BufferPolicyMode {
    return mode;
  }

  function getBufferCapacity(): number {
    // Capacity = targetSec * fps * 1.6 headroom
    return Math.ceil(cfg.targetSec * fps * 1.6);
  }

  function shouldTopUp(aheadSec: number, inflightCount: number): boolean {
    let effectiveTarget: number;
    let effectiveMaxInflight: number;

    switch (mode) {
      case "interactive":
        // Interactive: no buffer, at most 1 pending request
        effectiveTarget = 0;
        effectiveMaxInflight = 1;
        break;
      case "paused":
        // Paused: no buffer, allow refine frame
        effectiveTarget = 0;
        effectiveMaxInflight = refineRequested ? 1 : 0;
        break;
      case "playing":
      default:
        effectiveTarget = cfg.targetSec;
        effectiveMaxInflight = cfg.maxInflight;
        break;
    }

    if (effectiveTarget <= 0) {
      // Only top up if we have zero frames ahead and room for inflight
      return aheadSec <= 0 && inflightCount < effectiveMaxInflight;
    }

    return aheadSec < effectiveTarget && inflightCount < effectiveMaxInflight;
  }

  function recordStarvation(): boolean {
    starvationCounter++;
    return starvationCounter >= MAX_STARVATION_BEFORE_FALLBACK;
  }

  function resetStarvation(): void {
    starvationCounter = 0;
  }

  function consumeRefine(): boolean {
    const v = refineRequested;
    refineRequested = false;
    return v;
  }

  function getState(): BufferPolicyState {
    let effectiveTargetSec: number;
    let effectiveMaxInflight: number;

    switch (mode) {
      case "interactive":
        effectiveTargetSec = 0;
        effectiveMaxInflight = 1;
        break;
      case "paused":
        effectiveTargetSec = 0;
        effectiveMaxInflight = refineRequested ? 1 : 0;
        break;
      case "playing":
      default:
        effectiveTargetSec = cfg.targetSec;
        effectiveMaxInflight = cfg.maxInflight;
        break;
    }

    return {
      mode,
      effectiveTargetSec,
      effectiveMaxInflight,
      refineRequested,
      starved: starvationCounter > 0,
      starvationCounter,
    };
  }

  function reset(): void {
    mode = "playing";
    refineRequested = false;
    starvationCounter = 0;
  }

  return {
    setMode,
    getMode,
    getBufferCapacity,
    shouldTopUp,
    recordStarvation,
    resetStarvation,
    consumeRefine,
    getState,
    reset,
  };
}
