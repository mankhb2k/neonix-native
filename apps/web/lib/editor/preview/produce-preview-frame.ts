/**
 * Evaluate a composition frame and replay PaintCommandBuffer onto Canvas2D.
 * Shared by the preview worker and unit tests (no Worker/DOM globals).
 */

import {
  evaluateCompositionFrameV1,
  replayPaintCommands2D,
  type Canvas2DReplayContext,
  type EvaluatedCompositionFrame,
} from "@motionvideo/motion-runtime";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";

export type PreviewImageLookup = (
  uri: string,
  assetId?: string,
) => unknown | null;

export type ProducePreviewFrameInput = {
  runtime: MotionRuntimeProject;
  time: number;
  fps: number;
  width: number;
  height: number;
  ctx: Canvas2DReplayContext;
  getImage?: PreviewImageLookup;
};

export type ProducedPreviewFrame = {
  evaluated: EvaluatedCompositionFrame;
  evaluateMs: number;
  painterMs: number;
};

export function paintUrisFromFrame(
  evaluated: EvaluatedCompositionFrame,
): string[] {
  const uris = new Set<string>();
  for (const cmd of evaluated.paint.commands) {
    if (
      (cmd.op === "drawImage" || cmd.op === "drawVideo") &&
      "uri" in cmd &&
      typeof cmd.uri === "string" &&
      cmd.uri
    ) {
      uris.add(cmd.uri);
    }
  }
  return [...uris];
}

export type EvaluatedPreviewFrame = {
  evaluated: EvaluatedCompositionFrame;
  evaluateMs: number;
};

export function evaluatePreviewFrame(input: {
  runtime: MotionRuntimeProject;
  time: number;
  fps: number;
  width: number;
  height: number;
}): EvaluatedPreviewFrame | null {
  const fps = Math.max(1, input.fps);
  const frame = Math.max(0, Math.round(input.time * fps));
  const t0 =
    typeof performance !== "undefined" ? performance.now() : 0;
  const evaluated = evaluateCompositionFrameV1(
    input.runtime,
    frame,
    fps,
    input.width,
    input.height,
  );
  const evaluateMs =
    typeof performance !== "undefined" ? performance.now() - t0 : 0;
  if (!evaluated) return null;
  return { evaluated, evaluateMs };
}

export function replayEvaluatedPreview(
  ctx: Canvas2DReplayContext,
  evaluated: EvaluatedCompositionFrame,
  getImage?: PreviewImageLookup,
): number {
  const paintT0 =
    typeof performance !== "undefined" ? performance.now() : 0;
  replayPaintCommands2D(ctx, evaluated.paint, { getImage });
  return typeof performance !== "undefined" ? performance.now() - paintT0 : 0;
}

/** Evaluate + replay. Returns null when the playhead is outside the timeline. */
export function producePreviewFrame(
  input: ProducePreviewFrameInput,
): ProducedPreviewFrame | null {
  const evaluated = evaluatePreviewFrame(input);
  if (!evaluated) return null;
  const painterMs = replayEvaluatedPreview(
    input.ctx,
    evaluated.evaluated,
    input.getImage,
  );
  return {
    evaluated: evaluated.evaluated,
    evaluateMs: evaluated.evaluateMs,
    painterMs,
  };
}
