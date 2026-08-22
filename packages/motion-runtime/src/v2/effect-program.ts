/** A runtime-only surface identifier. Atomic Protocol V2 never serializes it. */
export type SurfaceRef = string;

export const RUNTIME_EFFECT_SOURCE_SURFACE = "source";

export type RuntimeColorAdjustEffectOp = {
  id: string;
  kind: "color-adjust";
  input: SurfaceRef;
  output: SurfaceRef;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
};

export type RuntimeBlurEffectOp = {
  id: string;
  kind: "blur";
  input: SurfaceRef;
  output: SurfaceRef;
  /** Gaussian sigma in projected composition/output pixels. */
  radius: number;
};

export type RuntimeAlphaMaskEffectOp = {
  id: string;
  kind: "alpha-mask";
  input: SurfaceRef;
  output: SurfaceRef;
};

export type RuntimeTintEffectOp = {
  id: string;
  kind: "tint";
  input: SurfaceRef;
  output: SurfaceRef;
  color: string;
  opacity: number;
};

export type RuntimeOffsetEffectOp = {
  id: string;
  kind: "offset";
  input: SurfaceRef;
  output: SurfaceRef;
  x: number;
  y: number;
};

export type RuntimeNoiseEffectOp = {
  id: string;
  kind: "noise";
  input: SurfaceRef;
  output: SurfaceRef;
  scale: number;
  amount: number;
  opacity: number;
  seed: number;
};

export type RuntimeCompositeEffectOp = {
  id: string;
  kind: "composite";
  backdrop: SurfaceRef;
  source: SurfaceRef;
  output: SurfaceRef;
  mode: "source-over";
};

export type RuntimeEffectOp =
  | RuntimeColorAdjustEffectOp
  | RuntimeBlurEffectOp
  | RuntimeAlphaMaskEffectOp
  | RuntimeTintEffectOp
  | RuntimeOffsetEffectOp
  | RuntimeNoiseEffectOp
  | RuntimeCompositeEffectOp;

export type RuntimeEffectProgram = {
  input: typeof RUNTIME_EFFECT_SOURCE_SURFACE;
  ops: RuntimeEffectOp[];
  output: SurfaceRef;
  requiresOffscreen: boolean;
};

export type RuntimeEffectProgramDiagnostic = {
  code: string;
  message: string;
  opId?: string;
};

export type RuntimeEffectProgramValidation = {
  ok: boolean;
  diagnostics: RuntimeEffectProgramDiagnostic[];
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inputsFor(op: RuntimeEffectOp): SurfaceRef[] {
  return op.kind === "composite" ? [op.backdrop, op.source] : [op.input];
}

function isSpatial(op: RuntimeEffectOp): boolean {
  return op.kind !== "color-adjust";
}

function validateOpFields(
  op: RuntimeEffectOp,
  diagnostics: RuntimeEffectProgramDiagnostic[],
): void {
  const invalid = (message: string) => {
    diagnostics.push({ code: "runtime_effect_program_invalid_operator", message, opId: op.id });
  };

  if (op.kind === "color-adjust") {
    if (![op.brightness, op.contrast, op.saturation, op.hueRotate].every(finite)) {
      invalid(`Effect operator "${op.id}" color-adjust values must be finite`);
    }
  } else if (op.kind === "blur") {
    if (!finite(op.radius) || op.radius < 0 || op.radius > 256) {
      invalid(`Effect operator "${op.id}" blur radius must be finite and within [0, 256]`);
    }
  } else if (op.kind === "tint") {
    if (!hasText(op.color) || !finite(op.opacity) || op.opacity < 0 || op.opacity > 1) {
      invalid(`Effect operator "${op.id}" tint requires a color and opacity within 0..1`);
    }
  } else if (op.kind === "offset") {
    if (!finite(op.x) || !finite(op.y)) {
      invalid(`Effect operator "${op.id}" offset values must be finite`);
    }
  } else if (op.kind === "noise") {
    if (!finite(op.scale) || op.scale <= 0 || op.scale > 256 || !finite(op.amount) || op.amount < 0 || op.amount > 1 || !finite(op.opacity) || op.opacity < 0 || op.opacity > 1 || !finite(op.seed) || op.seed < 0 || op.seed > 0xffffffff || !Number.isInteger(op.seed)) {
      invalid(`Effect operator "${op.id}" noise requires scale > 0, amount/opacity within 0..1, and an integer seed within 0..2^32-1`);
    }
  } else if (op.kind === "composite" && op.mode !== "source-over") {
    invalid(`Effect operator "${op.id}" has an unsupported composite mode`);
  }
}

/**
 * Validate the ordered, backend-neutral effect graph before a renderer plans
 * physical GPU surfaces. Program output cannot overwrite the immutable source.
 */
export function validateRuntimeEffectProgram(
  program: RuntimeEffectProgram,
): RuntimeEffectProgramValidation {
  const diagnostics: RuntimeEffectProgramDiagnostic[] = [];
  if (program.input !== RUNTIME_EFFECT_SOURCE_SURFACE) {
    diagnostics.push({
      code: "runtime_effect_program_input",
      message: `Effect program input must be "${RUNTIME_EFFECT_SOURCE_SURFACE}"`,
    });
  }
  if (!Array.isArray(program.ops) || program.ops.length === 0) {
    diagnostics.push({
      code: "runtime_effect_program_empty",
      message: "Effect program must contain at least one operator",
    });
  }

  const ids = new Set<string>();
  const outputOwners = new Map<SurfaceRef, RuntimeEffectOp>();
  for (const op of program.ops) {
    if (!hasText(op.id)) {
      diagnostics.push({ code: "runtime_effect_program_operator_id", message: "Effect operator id must be non-empty" });
    } else if (ids.has(op.id)) {
      diagnostics.push({ code: "runtime_effect_program_duplicate_operator", message: `Duplicate effect operator id "${op.id}"`, opId: op.id });
    }
    ids.add(op.id);

    if (!hasText(op.output)) {
      diagnostics.push({ code: "runtime_effect_program_surface", message: `Effect operator "${op.id}" output must be non-empty`, opId: op.id });
    } else if (op.output === RUNTIME_EFFECT_SOURCE_SURFACE) {
      diagnostics.push({ code: "runtime_effect_program_source_overwrite", message: `Effect operator "${op.id}" cannot overwrite the immutable source surface`, opId: op.id });
    } else if (outputOwners.has(op.output)) {
      diagnostics.push({ code: "runtime_effect_program_duplicate_surface", message: `Duplicate effect output surface "${op.output}"`, opId: op.id });
    } else {
      outputOwners.set(op.output, op);
    }
    validateOpFields(op, diagnostics);
  }

  const visiting = new Set<SurfaceRef>();
  const visited = new Set<SurfaceRef>();
  const visit = (surface: SurfaceRef) => {
    if (surface === RUNTIME_EFFECT_SOURCE_SURFACE || visited.has(surface)) return;
    if (visiting.has(surface)) {
      diagnostics.push({ code: "runtime_effect_program_cycle", message: `Effect program contains a cycle through surface "${surface}"` });
      return;
    }
    const owner = outputOwners.get(surface);
    if (!owner) return;
    visiting.add(surface);
    for (const input of inputsFor(owner)) visit(input);
    visiting.delete(surface);
    visited.add(surface);
  };
  for (const surface of outputOwners.keys()) visit(surface);

  const available = new Set<SurfaceRef>([RUNTIME_EFFECT_SOURCE_SURFACE]);
  const reachableOperators = new Set<string>();
  for (const op of program.ops) {
    const inputs = inputsFor(op);
    for (const input of inputs) {
      if (!hasText(input) || !available.has(input)) {
        diagnostics.push({ code: "runtime_effect_program_input_unavailable", message: `Effect operator "${op.id}" reads unavailable surface "${input}"`, opId: op.id });
      }
    }
    if (inputs.every((input) => available.has(input)) && hasText(op.output)) {
      available.add(op.output);
      reachableOperators.add(op.id);
    }
  }

  for (const op of program.ops) {
    if (!reachableOperators.has(op.id)) {
      diagnostics.push({ code: "runtime_effect_program_orphan", message: `Effect operator "${op.id}" is unreachable from the source surface`, opId: op.id });
    }
  }

  if (!hasText(program.output) || program.output === RUNTIME_EFFECT_SOURCE_SURFACE || !outputOwners.has(program.output)) {
    diagnostics.push({ code: "runtime_effect_program_output", message: "Effect program output must be a surface produced by an operator" });
  } else if (!available.has(program.output)) {
    diagnostics.push({ code: "runtime_effect_program_output_unreachable", message: `Effect program output "${program.output}" is unreachable from the source surface` });
  }

  const requiredSurfaces = new Set<SurfaceRef>();
  const markRequired = (surface: SurfaceRef) => {
    if (surface === RUNTIME_EFFECT_SOURCE_SURFACE || requiredSurfaces.has(surface)) return;
    requiredSurfaces.add(surface);
    const owner = outputOwners.get(surface);
    if (owner) {
      for (const input of inputsFor(owner)) markRequired(input);
    }
  };
  if (hasText(program.output)) markRequired(program.output);
  for (const op of program.ops) {
    if (reachableOperators.has(op.id) && !requiredSurfaces.has(op.output)) {
      diagnostics.push({ code: "runtime_effect_program_orphan", message: `Effect operator "${op.id}" does not contribute to the final output`, opId: op.id });
    }
  }

  const requiresOffscreen = program.ops.some(isSpatial);
  if (program.requiresOffscreen !== requiresOffscreen) {
    diagnostics.push({ code: "runtime_effect_program_offscreen", message: `Effect program requiresOffscreen must be ${requiresOffscreen}` });
  }

  return { ok: diagnostics.length === 0, diagnostics };
}

export function assertRuntimeEffectProgram(
  program: RuntimeEffectProgram,
): RuntimeEffectProgram {
  const validation = validateRuntimeEffectProgram(program);
  if (!validation.ok) {
    throw new Error(`Runtime Effect Program validation failed: ${validation.diagnostics.map((item) => item.message).join(" | ")}`);
  }
  return program;
}
