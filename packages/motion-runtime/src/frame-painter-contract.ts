/**
 * Shared painter contract: consume EvaluatedFrame only — never compile authoring
 * or re-run motion evaluation inside the paint path.
 */

import type { EvaluatedFrame } from "./evaluated-frame";

/**
 * Imperative frame painter used by Pixi / Remotion / parity harnesses.
 * Hosts evaluate once per tick, then call `paintFrame(evaluated)`.
 */
export type EvaluatedFramePainter = {
  paintFrame(evaluated: EvaluatedFrame): void;
};

/**
 * Host-facing stage port shape shared by Web and Desktop adapters.
 * `paintFrame(frameIndex)` may evaluate internally today; target state evaluates
 * in the host and paints via {@link EvaluatedFramePainter}.
 */
export type StageRendererPortShape = {
  setScale(scale: number): void;
  setBackground(color: string): void;
  paintFrame(frameIndex: number): void;
  /**
   * EvaluatedFrame from the most recent paint tick (interaction + paint).
   * Overlay / hit-test must use this when present so paint and overlay share one evaluate.
   */
  getLastEvaluatedFrame(): EvaluatedFrame | null;
  dispose(): void;
};
