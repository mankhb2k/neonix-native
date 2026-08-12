/**
 * Structured diagnostics for the motion compiler.
 *
 * Replaces string-throwing with typed diagnostic collection so callers
 * (editor store, AI planner, CLI scripts) can surface errors with
 * source locations, severity, and codes.
 */

import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

/** Canonical alias for the normalized project output. */
export type CompiledProject = MotionRuntimeProject;

// ── Diagnostic types ──────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticCode =
  // V3 compiler (Phase 5) — CMP_* family
  | "CMP_UNRESOLVED_VARIABLE"
  | "CMP_UNRESOLVED_COMPONENT"
  | "CMP_UNRESOLVED_ASSET"
  | "CMP_UNRESOLVED_PRESET"
  | "CMP_CYCLE_DETECTED"
  | "CMP_COMPONENT_INTEGRITY_MISMATCH"
  | "CMP_BINDING_TYPE_MISMATCH"
  | "CMP_CLIP_TARGET_MISSING"
  | "CMP_INVALID_CLIP_FIELD"
  | "CMP_PRIVATE_COMPONENT_ACCESS"
  | "CMP_INSTANCE_TRANSFORM_OVERLAP"
  // Capability preflight (Phase 11)
  | "CAP_UNDECLARED_CAPABILITY"
  | "CAP_EXPERIMENTAL_IN_USE"
  // Schema / reference
  | "UNKNOWN_VARIABLE"
  | "UNKNOWN_CLIP_TARGET"
  | "UNKNOWN_MARKER"
  | "UNKNOWN_COMPONENT"
  | "UNKNOWN_ACTION"
  | "UNKNOWN_SLOT"
  | "UNKNOWN_VARIANT"
  // Validation
  | "INVALID_KEYFRAME_TIME"
  | "INVALID_PLAYBACK_RATE"
  | "CLIP_SCHEDULE_CYCLE"
  | "CLIP_EXCEEDS_DURATION"
  | "NESTED_COMPONENT"
  | "NESTED_ACTION"
  | "REPEATER_INVALID_SOURCE"
  | "REPEATER_INVALID_ITEM"
  | "REPEATER_MISSING_KEY"
  | "PRESET_NO_TARGET"
  | "UNEXPANDED_ACTION_CLIP"
  // Layout / text
  | "TEXT_OVERFLOW"
  | "LAYOUT_CONSTRAINT_FAILED"
  // Runtime schema validation
  | "RUNTIME_VALIDATION_ERROR"
  // Compiler internal
  | "COMPILE_ERROR";

export type CompileDiagnostic = {
  /** Diagnostic code for programmatic handling */
  code: DiagnosticCode;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Path within the project (e.g. ["scenes", 0, "clips", 2]) */
  path?: (string | number)[];
  /** Source reference for editor highlighting */
  sourceRef?: string;
  /** Additional context */
  details?: Record<string, unknown>;
};

// ── Result types ──────────────────────────────────────────────────────

export type CompileSuccess<T> = {
  ok: true;
  project: T;
  diagnostics: CompileDiagnostic[];
};

export type CompileFailure = {
  ok: false;
  diagnostics: CompileDiagnostic[];
};

export type CompileResult<T> = CompileSuccess<T> | CompileFailure;

// ── Diagnostic helpers ────────────────────────────────────────────────

/**
 * Collects diagnostics during compilation. Replaces scattered `throw new Error`.
 */
export class DiagnosticCollector {
  private _diagnostics: CompileDiagnostic[] = [];
  private _errorCount = 0;

  /** All collected diagnostics so far */
  get diagnostics(): readonly CompileDiagnostic[] {
    return this._diagnostics;
  }

  /** Number of error-level diagnostics */
  get errorCount(): number {
    return this._errorCount;
  }

  /** Whether any errors have been collected */
  get hasErrors(): boolean {
    return this._errorCount > 0;
  }

  /** Add an error diagnostic */
  error(
    code: DiagnosticCode,
    message: string,
    opts?: {
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push({ code, message, severity: "error", ...opts });
    this._errorCount++;
  }

  /** Add a warning diagnostic */
  warn(
    code: DiagnosticCode,
    message: string,
    opts?: {
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push({ code, message, severity: "warning", ...opts });
  }

  /** Add an info diagnostic */
  info(
    code: DiagnosticCode,
    message: string,
    opts?: {
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push({ code, message, severity: "info", ...opts });
  }

  /** Throw if any errors were collected (for fatal cutoff points) */
  throwIfFatal(): void {
    if (this._errorCount > 0) {
      // Don't throw individual messages — return them in structured form.
      // This method exists for callers that want to abort early.
      throw new CompileDiagnosticError(this._diagnostics);
    }
  }

  /** Clear all diagnostics */
  clear(): void {
    this._diagnostics = [];
    this._errorCount = 0;
  }

  /** Merge diagnostics from another collector */
  merge(other: DiagnosticCollector): void {
    this._diagnostics.push(...other._diagnostics);
    this._errorCount += other._errorCount;
  }
}

/**
 * Error class that wraps diagnostics. Use when a caller wants try/catch
 * while still getting structured diagnostics.
 */
export class CompileDiagnosticError extends Error {
  readonly diagnostics: readonly CompileDiagnostic[];

  constructor(diagnostics: readonly CompileDiagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === "error");
    super(errors.map((d) => `[${d.code}] ${d.message}`).join("; "));
    this.name = "CompileDiagnosticError";
    this.diagnostics = diagnostics;
  }
}

// ── Helpers for building results ──────────────────────────────────────

export function compileSuccess<T>(
  project: T,
  diagnostics: CompileDiagnostic[] = [],
): CompileSuccess<T> {
  return { ok: true, project, diagnostics };
}

export function compileFailure(
  diagnostics: CompileDiagnostic[],
): CompileFailure {
  return { ok: false, diagnostics };
}
