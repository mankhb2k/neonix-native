import {
  RUNTIME_EFFECT_SOURCE_SURFACE,
  validateRuntimeEffectProgram,
  type RuntimeBlurEffectOp,
  type RuntimeColorAdjustEffectOp,
  type RuntimeCompositeEffectOp,
  type RuntimeEffectProgram,
  type RuntimeOffsetEffectOp,
  type RuntimeNoiseEffectOp,
  type RuntimeAlphaMaskEffectOp,
  type RuntimeInnerAlphaEffectOp,
  type RuntimeTintEffectOp,
} from "@motionvideo/motion-runtime";

export type DropShadowPass = {
  alphaMask: RuntimeAlphaMaskEffectOp;
  blur: RuntimeBlurEffectOp;
  tint: RuntimeTintEffectOp;
  offset: RuntimeOffsetEffectOp;
  composite: RuntimeCompositeEffectOp;
};

export type OuterGlowPass = {
  alphaMask: RuntimeAlphaMaskEffectOp;
  blur: RuntimeBlurEffectOp;
  tint: RuntimeTintEffectOp;
  composite: RuntimeCompositeEffectOp;
};

export type InnerGlowPass = {
  alphaMask: RuntimeAlphaMaskEffectOp;
  blur: RuntimeBlurEffectOp;
  innerAlpha: RuntimeInnerAlphaEffectOp;
  tint: RuntimeTintEffectOp;
  composite: RuntimeCompositeEffectOp;
};

/** Backend-neutral physical plan for the effect subset certified today. */
export type EffectPassPlan = {
  source: typeof RUNTIME_EFFECT_SOURCE_SURFACE;
  output: string;
  requiresOffscreen: boolean;
  sourceColorAdjust: RuntimeColorAdjustEffectOp[];
  blurs: RuntimeBlurEffectOp[];
  sourceNoise: RuntimeNoiseEffectOp[];
  outputNoise: RuntimeNoiseEffectOp[];
  outputColorAdjust: RuntimeColorAdjustEffectOp[];
  shadow?: DropShadowPass;
  outerGlow?: OuterGlowPass;
  innerGlow?: InnerGlowPass;
  diagnostics: EffectPassPlanDiagnostic[];
  supported: boolean;
};

function matchDropShadowPass(program: RuntimeEffectProgram): DropShadowPass | undefined {
  if (program.ops.length !== 5) return undefined;
  const [alphaMask, blur, tint, offset, composite] = program.ops;
  if (
    alphaMask?.kind !== "alpha-mask" ||
    blur?.kind !== "blur" ||
    tint?.kind !== "tint" ||
    offset?.kind !== "offset" ||
    composite?.kind !== "composite" ||
    alphaMask.input !== program.input ||
    blur.input !== alphaMask.output ||
    tint.input !== blur.output ||
    offset.input !== tint.output ||
    composite.backdrop !== offset.output ||
    composite.source !== program.input ||
    composite.output !== program.output ||
    composite.mode !== "source-over"
  ) return undefined;
  return { alphaMask, blur, tint, offset, composite };
}

function matchOuterGlowPass(program: RuntimeEffectProgram): OuterGlowPass | undefined {
  if (program.ops.length !== 4) return undefined;
  const [alphaMask, blur, tint, composite] = program.ops;
  if (
    alphaMask?.kind !== "alpha-mask" ||
    blur?.kind !== "blur" ||
    tint?.kind !== "tint" ||
    composite?.kind !== "composite" ||
    alphaMask.input !== program.input ||
    blur.input !== alphaMask.output ||
    tint.input !== blur.output ||
    composite.backdrop !== tint.output ||
    composite.source !== program.input ||
    composite.output !== program.output ||
    composite.mode !== "source-over"
  ) return undefined;
  return { alphaMask, blur, tint, composite };
}

function matchInnerGlowPass(program: RuntimeEffectProgram): InnerGlowPass | undefined {
  if (program.ops.length !== 5) return undefined;
  const [alphaMask, blur, innerAlpha, tint, composite] = program.ops;
  if (
    alphaMask?.kind !== "alpha-mask" ||
    blur?.kind !== "blur" ||
    innerAlpha?.kind !== "inner-alpha" ||
    tint?.kind !== "tint" ||
    composite?.kind !== "composite" ||
    alphaMask.input !== program.input ||
    blur.input !== alphaMask.output ||
    innerAlpha.source !== alphaMask.output ||
    innerAlpha.blurred !== blur.output ||
    tint.input !== innerAlpha.output ||
    composite.backdrop !== program.input ||
    composite.source !== tint.output ||
    composite.output !== program.output ||
    composite.mode !== "source-over"
  ) return undefined;
  return { alphaMask, blur, innerAlpha, tint, composite };
}

export type EffectPassPlanDiagnostic = {
  code: string;
  message: string;
  opId?: string;
};

/**
 * Compile a Runtime Effect Program into the pass shape both GPU backends
 * currently execute. Unsupported graphs are diagnosed, never reordered.
 */
export function buildEffectPassPlan(program: RuntimeEffectProgram): EffectPassPlan {
  const diagnostics: EffectPassPlanDiagnostic[] = [];
  const validation = validateRuntimeEffectProgram(program);
  for (const diagnostic of validation.diagnostics) {
    diagnostics.push({
      code: `effect_program_${diagnostic.code}`,
      message: diagnostic.message,
      ...(diagnostic.opId ? { opId: diagnostic.opId } : {}),
    });
  }

  const shadow = matchDropShadowPass(program);
  const outerGlow = matchOuterGlowPass(program);
  const innerGlow = matchInnerGlowPass(program);
  if (shadow) {
    return {
      source: program.input,
      output: program.output,
      requiresOffscreen: true,
      sourceColorAdjust: [],
      blurs: [],
      sourceNoise: [],
      outputNoise: [],
      outputColorAdjust: [],
      shadow,
      diagnostics,
      supported: diagnostics.length === 0,
    };
  }
  if (outerGlow) {
    return {
      source: program.input,
      output: program.output,
      requiresOffscreen: true,
      sourceColorAdjust: [],
      blurs: [],
      sourceNoise: [],
      outputNoise: [],
      outputColorAdjust: [],
      outerGlow,
      diagnostics,
      supported: diagnostics.length === 0,
    };
  }
  if (innerGlow) {
    return {
      source: program.input,
      output: program.output,
      requiresOffscreen: true,
      sourceColorAdjust: [],
      blurs: [],
      sourceNoise: [],
      outputNoise: [],
      outputColorAdjust: [],
      innerGlow,
      diagnostics,
      supported: diagnostics.length === 0,
    };
  }

  let expectedInput: string = program.input;
  const blurs: RuntimeBlurEffectOp[] = [];
  const sourceNoise: RuntimeNoiseEffectOp[] = [];
  const outputNoise: RuntimeNoiseEffectOp[] = [];
  let seenSpatial = false;
  const sourceColorAdjust: RuntimeColorAdjustEffectOp[] = [];
  const outputColorAdjust: RuntimeColorAdjustEffectOp[] = [];

  for (const [index, op] of program.ops.entries()) {
    if (op.kind === "composite") {
      diagnostics.push({
        code: "effect_pass_operator_unsupported",
        message: `Effect operator "${op.id}" (${op.kind}) is not executable by the rectangle pass planner`,
        opId: op.id,
      });
      continue;
    }
    if (op.kind === "inner-alpha") {
      diagnostics.push({
        code: "effect_pass_operator_unsupported",
        message: `Effect operator "${op.id}" (${op.kind}) is not executable by the linear rectangle pass planner`,
        opId: op.id,
      });
      continue;
    }
    if (op.input !== expectedInput) {
      diagnostics.push({
        code: "effect_pass_non_linear_graph",
        message: `Effect operator "${op.id}" does not consume the previous output surface`,
        opId: op.id,
      });
    }
    expectedInput = op.output;
    if (op.kind === "color-adjust") {
      if (seenSpatial && program.ops.slice(index + 1).some((next) => next.kind === "blur")) {
        diagnostics.push({
          code: "effect_pass_interleaved_color_adjust_unsupported",
          message: `Effect operator "${op.id}" appears between spatial operators and cannot be moved without changing order`,
          opId: op.id,
        });
      }
      (seenSpatial ? outputColorAdjust : sourceColorAdjust).push(op);
    } else if (op.kind === "blur") {
      if (outputColorAdjust.length) {
        diagnostics.push({
          code: "effect_pass_interleaved_color_adjust_unsupported",
          message: `Blur operator "${op.id}" follows a post-spatial color adjustment and cannot be reordered`,
          opId: op.id,
        });
      }
      blurs.push(op);
      seenSpatial = true;
    } else if (op.kind === "noise") {
      (seenSpatial ? outputNoise : sourceNoise).push(op);
      seenSpatial = true;
    } else {
      diagnostics.push({
        code: "effect_pass_operator_unsupported",
        message: `Effect operator "${op.id}" (${op.kind}) is not executable by the rectangle pass planner`,
        opId: op.id,
      });
      seenSpatial = true;
    }
  }

  if (expectedInput !== program.output) {
    diagnostics.push({
      code: "effect_pass_output_mismatch",
      message: `Effect program output "${program.output}" is not the final planned surface "${expectedInput}"`,
    });
  }
  if (sourceColorAdjust.length > 4 || outputColorAdjust.length > 4) {
    diagnostics.push({
      code: "effect_pass_color_adjust_limit",
      message: "The current GPU source/post shader supports at most four ordered color-adjust operators per pass",
    });
  }
  if (sourceNoise.length > 1 || outputNoise.length > 1) {
    diagnostics.push({
      code: "effect_pass_noise_limit",
      message: "The current GPU post shader supports at most one noise operator before and after spatial operators",
    });
  }

  return {
    source: program.input,
    output: program.output,
    requiresOffscreen: program.requiresOffscreen,
    sourceColorAdjust,
    blurs,
    sourceNoise,
    outputNoise,
    outputColorAdjust,
    ...(shadow ? { shadow } : {}),
    diagnostics,
    supported: diagnostics.length === 0,
  };
}
