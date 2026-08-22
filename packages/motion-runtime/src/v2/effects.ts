import type { RuntimeEffect } from "../paint/paint-types";
import {
  assertRuntimeEffectProgram,
  RUNTIME_EFFECT_SOURCE_SURFACE,
  type RuntimeEffectOp,
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
    if (effect.type === "drop-shadow") {
      const alpha = `effect:${effect.id}:alpha`;
      const blurred = `effect:${effect.id}:blur`;
      const tinted = `effect:${effect.id}:tint`;
      const offset = `effect:${effect.id}:offset`;
      const output = outputSurfaceFor(effect.id);
      ops.push(
        { id: `${effect.id}:alpha`, kind: "alpha-mask", input, output: alpha },
        { id: `${effect.id}:blur`, kind: "blur", input: alpha, output: blurred, radius: effect.blur },
        { id: `${effect.id}:tint`, kind: "tint", input: blurred, output: tinted, color: effect.color, opacity: effect.opacity },
        { id: `${effect.id}:offset`, kind: "offset", input: tinted, output: offset, x: effect.x, y: effect.y },
        { id: `${effect.id}:composite`, kind: "composite", backdrop: offset, source: input, output, mode: "source-over" },
      );
      input = output;
      continue;
    }
    const output = outputSurfaceFor(effect.id);
    const op: RuntimeEffectOp = effect.type === "blur"
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
