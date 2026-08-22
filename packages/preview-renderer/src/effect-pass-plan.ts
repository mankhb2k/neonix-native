import {
  RUNTIME_EFFECT_SOURCE_SURFACE,
  validateRuntimeEffectProgram,
  type RuntimeBlurEffectOp,
  type RuntimeColorAdjustEffectOp,
  type RuntimeEffectProgram,
} from "@motionvideo/motion-runtime";

/** Backend-neutral physical plan for the effect subset certified today. */
export type EffectPassPlan = {
  source: typeof RUNTIME_EFFECT_SOURCE_SURFACE;
  output: string;
  requiresOffscreen: boolean;
  sourceColorAdjust: RuntimeColorAdjustEffectOp[];
  blur?: RuntimeBlurEffectOp;
  outputColorAdjust: RuntimeColorAdjustEffectOp[];
  diagnostics: EffectPassPlanDiagnostic[];
  supported: boolean;
};

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

  let expectedInput: string = program.input;
  let blur: RuntimeBlurEffectOp | undefined;
  let seenSpatial = false;
  const sourceColorAdjust: RuntimeColorAdjustEffectOp[] = [];
  const outputColorAdjust: RuntimeColorAdjustEffectOp[] = [];

  for (const op of program.ops) {
    if (op.kind === "composite") {
      diagnostics.push({
        code: "effect_pass_operator_unsupported",
        message: `Effect operator "${op.id}" (${op.kind}) is not executable by the rectangle pass planner`,
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
      (seenSpatial ? outputColorAdjust : sourceColorAdjust).push(op);
    } else if (op.kind === "blur") {
      if (blur) {
        diagnostics.push({
          code: "effect_pass_multiple_blur_unsupported",
          message: "The initial pass planner supports one blur operator per effect program",
          opId: op.id,
        });
      } else {
        blur = op;
      }
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

  return {
    source: program.input,
    output: program.output,
    requiresOffscreen: program.requiresOffscreen,
    sourceColorAdjust,
    ...(blur ? { blur } : {}),
    outputColorAdjust,
    diagnostics,
    supported: diagnostics.length === 0,
  };
}
