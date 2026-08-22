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
  const ops: RuntimeEffectOp[] = effects.map((effect) => {
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
    return op;
  });

  return assertRuntimeEffectProgram({
    input: RUNTIME_EFFECT_SOURCE_SURFACE,
    ops,
    output: input,
    requiresOffscreen: ops.some((op) => op.kind !== "color-adjust"),
  });
}
