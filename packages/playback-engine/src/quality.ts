/**
 * Quality modes — control the trade-off between latency and fidelity.
 *
 * §Phase 6 Task 6.5 in core-engine-tasks.md
 *
 * Three tiers:
 *   - interactive: low latency for scrub/drag (may skip effects, lower res)
 *   - playback: balanced for real-time preview (full effects, target FPS)
 *   - final: highest quality (renders one extra "refine" frame after pause)
 */

export type QualityMode = "interactive" | "playback" | "final";

export type QualityState = {
  mode: QualityMode;
  /** Whether to perform a "refine" render after the clock stops (final mode). */
  needsRefineAfterStop: boolean;
  /** Scale factor for composition resolution in interactive mode (0.5 = half res). */
  interactiveScale: number;
};

export type QualityController = {
  /** Get the current quality mode. */
  getMode(): QualityMode;

  /** Set the quality mode. */
  setMode(mode: QualityMode): void;

  /** After pause in final mode, returns true and resets the flag. */
  consumeRefineNeeded(): boolean;

  /**
   * Whether the engine should skip expensive effects in the current mode.
   */
  shouldSkipExpensiveEffects(): boolean;

  /**
   * Resolution scale to apply to composition resolution.
   * 1.0 = full, 0.5 = half (interactive).
   */
  getResolutionScale(): number;

  /** Get full state snapshot. */
  getState(): QualityState;
};

export function createQualityController(
  initial?: QualityMode,
): QualityController {
  let mode: QualityMode = initial ?? "playback";
  let needsRefine = false;
  const interactiveScale = 0.5;

  return {
    getMode: () => mode,

    setMode(next) {
      const prev = mode;
      mode = next;
      // When stopping in final mode, flag a refine render
      if (prev === "final" && next !== "final") {
        needsRefine = true;
      }
    },

    consumeRefineNeeded() {
      const v = needsRefine;
      needsRefine = false;
      return v;
    },

    shouldSkipExpensiveEffects() {
      return mode === "interactive";
    },

    getResolutionScale() {
      return mode === "interactive" ? interactiveScale : 1;
    },

    getState() {
      return { mode, needsRefineAfterStop: needsRefine, interactiveScale };
    },
  };
}
