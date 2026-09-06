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

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

function interpolatedMatrix(amount: number, full: readonly number[]): number[] {
  const identity = identityMatrix();
  return identity.map((value, index) => value + (full[index]! - value) * amount);
}

function matrixForEffect(effect: Extract<RuntimeEffect, { type: "grayscale" | "sepia" | "invert" }>): number[] {
  if (effect.type === "grayscale") {
    return interpolatedMatrix(effect.amount, [LUMA_R, LUMA_G, LUMA_B, 0, 0, LUMA_R, LUMA_G, LUMA_B, 0, 0, LUMA_R, LUMA_G, LUMA_B, 0, 0, 0, 0, 0, 1, 0]);
  }
  if (effect.type === "sepia") {
    return interpolatedMatrix(effect.amount, [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0]);
  }
  return interpolatedMatrix(effect.amount, [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0]);
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
  let previousEffectWasShadow = false;
  for (const effect of effects) {
    if (effect.type === "shadow" || effect.type === "outer-glow" || effect.type === "inner-glow") {
      if (effect.type === "shadow" && (effect.spread !== 0 || effect.inset)) {
        throw new Error(`Runtime shadow spread/inset is not lowered yet: ${effect.id}`);
      }
      const alpha = `effect:${effect.id}:alpha`;
      const blurred = `effect:${effect.id}:blur`;
      const inner = `effect:${effect.id}:inner-alpha`;
      const tinted = `effect:${effect.id}:tint`;
      const output = outputSurfaceFor(effect.id);
      const alphaInput = previousEffectWasShadow ? RUNTIME_EFFECT_SOURCE_SURFACE : input;
      ops.push(
        // Consecutive comma-separated shadows all use the owner's silhouette.
        // A shadow after another spatial/color filter instead uses that
        // filter's output, preserving CSS filter order without recursion.
        { id: `${effect.id}:alpha`, kind: "alpha-mask", input: effect.type === "shadow" ? alphaInput : input, output: alpha },
        {
          id: `${effect.id}:blur`,
          kind: "blur",
          input: alpha,
          output: blurred,
          radius: effect.type === "shadow" ? effect.blur : effect.radius,
        },
      );
      if (effect.type === "inner-glow") {
        ops.push({ id: `${effect.id}:inner`, kind: "inner-alpha", source: alpha, blurred, output: inner });
      }
      ops.push({
        id: `${effect.id}:tint`,
        kind: "tint",
        input: effect.type === "inner-glow" ? inner : blurred,
        output: tinted,
        color: effect.color,
        opacity: effect.type === "shadow" ? 1 : effect.opacity,
      });
      if (effect.type === "shadow") {
        const offset = `effect:${effect.id}:offset`;
        ops.push(
          { id: `${effect.id}:offset`, kind: "offset", input: tinted, output: offset, x: effect.offset.x, y: effect.offset.y },
         { id: `${effect.id}:composite`, kind: "composite", backdrop: offset, source: input, output, mode: "source-over" },
       );
      } else if (effect.type === "outer-glow") {
        ops.push({ id: `${effect.id}:composite`, kind: "composite", backdrop: tinted, source: input, output, mode: "source-over" });
      } else {
        ops.push({ id: `${effect.id}:composite`, kind: "composite", backdrop: input, source: tinted, output, mode: "source-over" });
      }
      input = output;
      previousEffectWasShadow = effect.type === "shadow";
      continue;
    }
    previousEffectWasShadow = false;
    if (effect.type === "grayscale" || effect.type === "sepia" || effect.type === "invert") {
      const output = outputSurfaceFor(effect.id);
      ops.push({ id: effect.id, kind: "color-matrix", input, output, matrix: matrixForEffect(effect) });
      input = output;
      continue;
    }
    if (effect.type === "filter-opacity") {
      const output = outputSurfaceFor(effect.id);
      ops.push({ id: effect.id, kind: "alpha", input, output, amount: effect.amount });
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
          colorInterpolationFilters: effect.colorInterpolationFilters,
        };
    input = output;
    ops.push(op);
  }

  return assertRuntimeEffectProgram({
    input: RUNTIME_EFFECT_SOURCE_SURFACE,
    ops,
    output: input,
    requiresOffscreen: ops.some((op) => op.kind !== "color-adjust" && op.kind !== "color-matrix" && op.kind !== "alpha"),
  });
}
