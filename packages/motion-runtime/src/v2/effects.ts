import type { RuntimeEffect } from "../paint/paint-types";
import {
  assertRuntimeEffectProgram,
  RUNTIME_EFFECT_SOURCE_SURFACE,
  type RuntimeEffectOp,
  type RuntimeNoiseEffectOp,
  type RuntimeEffectProgram,
  type SurfaceRef,
} from "./effect-program";

function outputSurfaceFor(effectId: string): SurfaceRef {
  return `effect:${effectId}`;
}

/**
 * Lower ordered Atomic V2 effects into a backend-neutral Runtime program.
 * Physical passes such as capture, pyramid levels, and Gaussian taps remain
 * owned by each renderer backend.
 */
export function buildRuntimeEffectProgram(
  effects: readonly RuntimeEffect[] | undefined,
): RuntimeEffectProgram | undefined {
  if (!effects?.length) return undefined;

  let input: SurfaceRef = RUNTIME_EFFECT_SOURCE_SURFACE;
  const ops: RuntimeEffectOp[] = [];
  for (const effect of effects) {
    if (effect.type === "drop-shadow" || effect.type === "outer-glow" || effect.type === "inner-glow") {
      const alpha = `effect:${effect.id}:alpha`;
      const blurred = `effect:${effect.id}:blur`;
      const inner = `effect:${effect.id}:inner-alpha`;
      const tinted = `effect:${effect.id}:tint`;
      const output = outputSurfaceFor(effect.id);
      ops.push(
        { id: `${effect.id}:alpha`, kind: "alpha-mask", input, output: alpha },
        {
          id: `${effect.id}:blur`,
          kind: "blur",
          input: alpha,
          output: blurred,
          radius: effect.type === "drop-shadow" ? effect.blur : effect.radius,
        },
      );
      if (effect.type === "inner-glow") {
        ops.push({ id: `${effect.id}:inner`, kind: "inner-alpha", source: alpha, blurred, output: inner });
      }
      ops.push({ id: `${effect.id}:tint`, kind: "tint", input: effect.type === "inner-glow" ? inner : blurred, output: tinted, color: effect.color, opacity: effect.opacity });
      if (effect.type === "drop-shadow") {
        const offset = `effect:${effect.id}:offset`;
        ops.push(
          { id: `${effect.id}:offset`, kind: "offset", input: tinted, output: offset, x: effect.x, y: effect.y },
          { id: `${effect.id}:composite`, kind: "composite", backdrop: offset, source: input, output, mode: "source-over" },
        );
      } else if (effect.type === "outer-glow") {
        ops.push({ id: `${effect.id}:composite`, kind: "composite", backdrop: tinted, source: input, output, mode: "source-over" });
      } else {
        ops.push({ id: `${effect.id}:composite`, kind: "composite", backdrop: input, source: tinted, output, mode: "source-over" });
      }
      input = output;
      continue;
    }
    const output = outputSurfaceFor(effect.id);
    const op: RuntimeEffectOp = effect.type === "noise"
      ? {
          id: effect.id,
          kind: "noise",
          input,
          output,
          scale: effect.scale,
          amount: effect.amount,
          opacity: effect.opacity,
          seed: effect.seed,
        }
      : effect.type === "blur"
      ? {
          id: effect.id,
          kind: "blur",
          input,
          output,
          radius: effect.radius,
        }
      : {
          id: effect.id,
          kind: "color-adjust",
          input,
          output,
          brightness: effect.brightness,
          contrast: effect.contrast,
          saturation: effect.saturation,
          hueRotate: effect.hueRotate,
        };
    input = output;
    ops.push(op);
  }

  return assertRuntimeEffectProgram({
    input: RUNTIME_EFFECT_SOURCE_SURFACE,
    ops,
    output: input,
    requiresOffscreen: ops.some((op) => op.kind !== "color-adjust"),
  });
}
