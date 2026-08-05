/**
 * EvaluatedFrame — single evaluate pass for interaction snapshot + paint buffer.
 */

import type { RuntimeScene } from "./evaluator";
import {
  buildPaintCommandBuffer,
  type PaintCommandBuffer,
  type RenderDiagnostic,
} from "./paint-commands";
import {
  buildRenderSnapshot,
  type RenderSnapshot,
} from "./render-snapshot";

export type EvaluatedFrame = {
  frame: number;
  time: number;
  sceneId: string;
  interaction: RenderSnapshot;
  paint: PaintCommandBuffer;
  diagnostics: RenderDiagnostic[];
};

export type EvaluateFrameInput = {
  scene: RuntimeScene;
  frame: number;
  time: number;
  width: number;
  height: number;
  background?: string;
  assetUriById?: Map<string, string> | Record<string, string>;
};

/**
 * Evaluate one frame → interaction snapshot + paint commands.
 * Deterministic for the same scene/time/assets.
 */
export function evaluateFrame(input: EvaluateFrameInput): EvaluatedFrame {
  const interaction = buildRenderSnapshot({
    scene: input.scene,
    time: input.time,
    frame: input.frame,
    width: input.width,
    height: input.height,
    background: input.background,
    assetUriById: input.assetUriById,
  });
  const paint = buildPaintCommandBuffer(interaction);
  return {
    frame: input.frame,
    time: input.time,
    sceneId: interaction.sceneId,
    interaction,
    paint,
    diagnostics: paint.diagnostics,
  };
}
