/**
 * Phase 12 — Unified runtime diagnostics.
 *
 * Replaces scattered `throw new Error` in the evaluator with structured
 * diagnostic collection so callers can surface errors with severity,
 * codes, frame/time, and source paths without crashing the pipeline.
 *
 * Design:
 *   - `RuntimeDiagnosticCode`: enumerated error/warning/info codes (mirrors compiler pattern)
 *   - `RuntimeDiagnostic`: extends RenderDiagnostic with `frame`, `time`, `path`, `details`
 *   - `RuntimeDiagnosticCollector`: collector class with error/warn/info/throwIfFatal
 *   - `RUNTIME_DIAGNOSTIC_CODES`: map from code to default severity + message template
 *
 * Backward-compat:
 *   - `RenderDiagnostic` in paint/paint-command.ts is unchanged; `RuntimeDiagnostic`
 *     is a superset. Paint commands still emit `RenderDiagnostic`.
 *   - All new fields are optional — existing code that only reads `severity`/`code`/`message`
 *     continues to work.
 */

// ── Diagnostic codes ──────────────────────────────────────────────────

/**
 * Enumerated diagnostic codes for the motion runtime.
 * Each code maps to a default severity and a human-readable message template.
 */
export const RuntimeDiagnosticCode = {
  // ── Scene / evaluation ──────────────────────────────────────────
  PARENT_CYCLE: "PARENT_CYCLE",
  PARENT_MISSING: "PARENT_MISSING",
  NODE_INVISIBLE: "NODE_INVISIBLE",
  MATRIX_NOT_INVERTIBLE: "MATRIX_NOT_INVERTIBLE",
  CONSTRAINT_TARGET_MISSING: "CONSTRAINT_TARGET_MISSING",
  MOTION_PATH_SOURCE_MISSING: "MOTION_PATH_SOURCE_MISSING",
  SECONDARY_MOTION_DRIVER_MISSING: "SECONDARY_MOTION_DRIVER_MISSING",
  ZERO_DURATION_SCENE: "ZERO_DURATION_SCENE",
  EMPTY_SCENE: "EMPTY_SCENE",
  CAMERA_TARGET_MISSING: "CAMERA_TARGET_MISSING",

  // ── Property evaluation ─────────────────────────────────────────
  INVALID_KEYFRAME_VALUE: "INVALID_KEYFRAME_VALUE",
  NON_FINITE_VALUE: "NON_FINITE_VALUE",
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  OUT_OF_RANGE_VALUE: "OUT_OF_RANGE_VALUE",
  TYPE_MISMATCH: "TYPE_MISMATCH",

  // ── Compositing / rendering ─────────────────────────────────────
  OFFSCREEN_BUDGET_EXCEEDED: "OFFSCREEN_BUDGET_EXCEEDED",
  UNSUPPORTED_BLEND_MODE: "UNSUPPORTED_BLEND_MODE",
  UNSUPPORTED_EFFECT: "UNSUPPORTED_EFFECT",
  MASK_SOURCE_MISSING: "MASK_SOURCE_MISSING",
  LAYER_ISOLATION_DEGRADED: "LAYER_ISOLATION_DEGRADED",

  // ── Assets / media ──────────────────────────────────────────────
  ASSET_URI_MISSING: "ASSET_URI_MISSING",
  ASSET_LOAD_FAILED: "ASSET_LOAD_FAILED",
  ASSET_DECODE_FAILED: "ASSET_DECODE_FAILED",
  VIDEO_SEEK_FAILED: "VIDEO_SEEK_FAILED",
  FONT_LOAD_FAILED: "FONT_LOAD_FAILED",
  AUDIO_DECODE_FAILED: "AUDIO_DECODE_FAILED",
  PATH_EMPTY_CONTOURS: "PATH_EMPTY_CONTOURS",

  // ── Worker / protocol ───────────────────────────────────────────
  WORKER_PROTOCOL_MISMATCH: "WORKER_PROTOCOL_MISMATCH",
  WORKER_FRAME_DROPPED: "WORKER_FRAME_DROPPED",
  WORKER_TIMEOUT: "WORKER_TIMEOUT",
  PAINT_VERSION_MISMATCH: "PAINT_VERSION_MISMATCH",
  EMPTY_COMMAND_BUFFER: "EMPTY_COMMAND_BUFFER",

  // ── Cancellation / lifecycle ────────────────────────────────────
  EVALUATION_CANCELLED: "EVALUATION_CANCELLED",
  COMPILE_CANCELLED: "COMPILE_CANCELLED",
  RENDER_CANCELLED: "RENDER_CANCELLED",
  EXPORT_CANCELLED: "EXPORT_CANCELLED",

  // ── Capability / compatibility ──────────────────────────────────
  CAPABILITY_NOT_IN_LEDGER: "CAPABILITY_NOT_IN_LEDGER",
  UNSUPPORTED_NODE_TYPE: "UNSUPPORTED_NODE_TYPE",
  UNSUPPORTED_PAYLOAD: "UNSUPPORTED_PAYLOAD",
  FEATURE_NOT_ENABLED: "FEATURE_NOT_ENABLED",

  // ── Fuzz / soak ─────────────────────────────────────────────────
  CYCLE_DETECTED: "CYCLE_DETECTED",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  SCHEMA_LIMIT_EXCEEDED: "SCHEMA_LIMIT_EXCEEDED",
  MEMORY_PRESSURE: "MEMORY_PRESSURE",
} as const;

export type RuntimeDiagnosticCode =
  (typeof RuntimeDiagnosticCode)[keyof typeof RuntimeDiagnosticCode];

// ── Diagnostic record ─────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * Default severity and message template for each diagnostic code.
 */
export type DiagnosticCodeMeta = {
  severity: DiagnosticSeverity;
  message: string;
};

/**
 * Maps diagnostic codes to their default severity and human-readable
 * message template. Callers can override the message.
 */
export const RUNTIME_DIAGNOSTIC_CODE_META: Record<
  RuntimeDiagnosticCode,
  DiagnosticCodeMeta
> = {
  PARENT_CYCLE: {
    severity: "error",
    message: "A parent cycle was detected in the scene graph.",
  },
  PARENT_MISSING: {
    severity: "error",
    message: "The referenced parent node does not exist in the scene.",
  },
  NODE_INVISIBLE: { severity: "info", message: "Node is invisible." },
  MATRIX_NOT_INVERTIBLE: {
    severity: "warning",
    message:
      "The transform matrix is singular (non-invertible). Using identity fallback.",
  },
  CONSTRAINT_TARGET_MISSING: {
    severity: "warning",
    message: "Constraint target node not found; constraint skipped.",
  },
  MOTION_PATH_SOURCE_MISSING: {
    severity: "error",
    message: "Motion path source node not found.",
  },
  SECONDARY_MOTION_DRIVER_MISSING: {
    severity: "error",
    message: "Secondary motion driver node not found.",
  },
  ZERO_DURATION_SCENE: {
    severity: "warning",
    message: "Scene has zero duration (no keyframes).",
  },
  EMPTY_SCENE: {
    severity: "info",
    message: "Scene has no drawable layers.",
  },
  CAMERA_TARGET_MISSING: {
    severity: "warning",
    message: "Active camera target not found; using identity projection.",
  },

  INVALID_KEYFRAME_VALUE: {
    severity: "error",
    message: "A keyframe value could not be evaluated.",
  },
  NON_FINITE_VALUE: {
    severity: "warning",
    message: "A non-finite (NaN/Infinity) value was clamped to a safe default.",
  },
  PROPERTY_NOT_FOUND: {
    severity: "warning",
    message: "The referenced property does not exist on the node.",
  },
  OUT_OF_RANGE_VALUE: {
    severity: "warning",
    message: "A value was outside the allowed range and was clamped.",
  },
  TYPE_MISMATCH: {
    severity: "error",
    message: "The keyframe value type does not match the property type.",
  },

  OFFSCREEN_BUDGET_EXCEEDED: {
    severity: "warning",
    message: "Offscreen render budget exceeded; layers may degrade.",
  },
  UNSUPPORTED_BLEND_MODE: {
    severity: "warning",
    message: "Unsupported blend mode; falling back to normal.",
  },
  UNSUPPORTED_EFFECT: {
    severity: "warning",
    message: "Unsupported effect; skipping.",
  },
  MASK_SOURCE_MISSING: {
    severity: "warning",
    message: "Mask source node not found; mask skipped.",
  },
  LAYER_ISOLATION_DEGRADED: {
    severity: "warning",
    message: "Layer isolation degraded; may affect compositing quality.",
  },

  ASSET_URI_MISSING: {
    severity: "warning",
    message: "Asset has no resolved URI.",
  },
  ASSET_LOAD_FAILED: {
    severity: "error",
    message: "Asset failed to load.",
  },
  ASSET_DECODE_FAILED: {
    severity: "error",
    message: "Asset failed to decode.",
  },
  VIDEO_SEEK_FAILED: {
    severity: "warning",
    message: "Video seek failed; using last valid frame.",
  },
  FONT_LOAD_FAILED: {
    severity: "warning",
    message: "Font failed to load; using fallback.",
  },
  AUDIO_DECODE_FAILED: {
    severity: "warning",
    message: "Audio failed to decode; track will be silent.",
  },
  PATH_EMPTY_CONTOURS: {
    severity: "warning",
    message: "Path has no contours; skipping draw.",
  },

  WORKER_PROTOCOL_MISMATCH: {
    severity: "error",
    message: "Worker protocol version mismatch.",
  },
  WORKER_FRAME_DROPPED: {
    severity: "warning",
    message: "Worker frame was dropped (buffer full or timeout).",
  },
  WORKER_TIMEOUT: {
    severity: "warning",
    message: "Worker did not respond in time; using last valid frame.",
  },
  PAINT_VERSION_MISMATCH: {
    severity: "error",
    message: "Paint command buffer version mismatch.",
  },
  EMPTY_COMMAND_BUFFER: {
    severity: "warning",
    message: "Paint command buffer is empty; nothing to render.",
  },

  EVALUATION_CANCELLED: {
    severity: "info",
    message: "Frame evaluation was cancelled.",
  },
  COMPILE_CANCELLED: {
    severity: "info",
    message: "Compilation was cancelled.",
  },
  RENDER_CANCELLED: { severity: "info", message: "Render was cancelled." },
  EXPORT_CANCELLED: { severity: "info", message: "Export was cancelled." },

  CAPABILITY_NOT_IN_LEDGER: {
    severity: "error",
    message: "Node type has no registered paint capability.",
  },
  UNSUPPORTED_NODE_TYPE: {
    severity: "error",
    message: "Node type is not supported by the paint pipeline.",
  },
  UNSUPPORTED_PAYLOAD: {
    severity: "error",
    message: "Payload kind is not supported.",
  },
  FEATURE_NOT_ENABLED: {
    severity: "warning",
    message: "Feature is not enabled in this runtime.",
  },

  CYCLE_DETECTED: {
    severity: "error",
    message: "A cycle was detected in the node graph.",
  },
  INVALID_REFERENCE: {
    severity: "error",
    message: "A reference points to a non-existent node.",
  },
  SCHEMA_LIMIT_EXCEEDED: {
    severity: "error",
    message: "A value exceeded the schema-defined limit.",
  },
  MEMORY_PRESSURE: {
    severity: "warning",
    message: "Memory pressure detected; consider reducing complexity.",
  },
};

// ── Runtime diagnostic type ───────────────────────────────────────────

/**
 * A structured runtime diagnostic with code, severity, source location,
 * and optional frame/time enrichment.
 *
 * Backward-compatible with {@link RenderDiagnostic} — all RenderDiagnostic
 * fields are present; runtime-specific fields (`frame`, `time`, `path`,
 * `details`) are optional.
 */
export type RuntimeDiagnostic = {
  /** Enumerated diagnostic code */
  code: RuntimeDiagnosticCode;
  /** Human-readable message (may override the default template) */
  message: string;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Node ID that triggered this diagnostic */
  layerId?: string;
  /** Paint command key (if diagnostic occurred during paint dispatch) */
  key?: string;
  /** Composition frame index (when known) */
  frame?: number;
  /** Composition time in seconds (when known) */
  time?: number;
  /** Scene ID that triggered this diagnostic */
  sceneId?: string;
  /** Structural path within the project (e.g. ["scenes", 0, "layers", 5]) */
  path?: (string | number)[];
  /** Source reference for editor highlighting */
  sourceRef?: string;
  /** Additional context payload */
  details?: Record<string, unknown>;
};

// ── Diagnostic helpers ────────────────────────────────────────────────

/**
 * Create a runtime diagnostic with defaults from the code metadata.
 * The caller-provided message overrides the default template.
 */
export function createDiagnostic(
  code: RuntimeDiagnosticCode,
  opts?: {
    message?: string;
    layerId?: string;
    key?: string;
    frame?: number;
    time?: number;
    sceneId?: string;
    path?: (string | number)[];
    sourceRef?: string;
    details?: Record<string, unknown>;
  },
): RuntimeDiagnostic {
  const meta = RUNTIME_DIAGNOSTIC_CODE_META[code];
  return {
    code,
    message: opts?.message ?? meta.message,
    severity: meta.severity,
    ...opts,
  };
}

/**
 * Convert a RuntimeDiagnostic to a RenderDiagnostic (backward compat).
 * Strips runtime-only fields like `frame`, `time`, `path`.
 */
export function toRenderDiagnostic(diag: RuntimeDiagnostic): {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  layerId?: string;
  key?: string;
} {
  return {
    severity: diag.severity,
    code: diag.code,
    message: diag.message,
    layerId: diag.layerId,
    key: diag.key,
  };
}

// ── Diagnostic collector ──────────────────────────────────────────────

/**
 * Collects runtime diagnostics during frame evaluation.
 * Modeled after the compiler's {@link DiagnosticCollector}.
 *
 * Usage:
 * ```typescript
 * const collector = new RuntimeDiagnosticCollector();
 * collector.error("PARENT_MISSING", { layerId: "n1" });
 * if (collector.hasErrors) collector.throwIfFatal();
 * const result = { diagnostics: collector.diagnostics() };
 * ```
 */
export class RuntimeDiagnosticCollector {
  private _diagnostics: RuntimeDiagnostic[] = [];
  private _frame: number;
  private _time: number;
  private _sceneId?: string;

  constructor(opts?: { frame?: number; time?: number; sceneId?: string }) {
    this._frame = opts?.frame ?? 0;
    this._time = opts?.time ?? 0;
    this._sceneId = opts?.sceneId;
  }

  /** Set the current frame/time context for subsequent diagnostics. */
  setFrame(frame: number, time: number): void {
    this._frame = frame;
    this._time = time;
  }

  /** Set the current scene context. */
  setScene(sceneId: string): void {
    this._sceneId = sceneId;
  }

  /** All collected diagnostics */
  get diagnostics(): readonly RuntimeDiagnostic[] {
    return this._diagnostics;
  }

  /** Number of error-level diagnostics */
  get errorCount(): number {
    return this._diagnostics.filter((d) => d.severity === "error").length;
  }

  /** Whether any error-level diagnostics have been collected */
  get hasErrors(): boolean {
    return this.errorCount > 0;
  }

  /** Add an error diagnostic */
  error(
    code: RuntimeDiagnosticCode,
    opts?: {
      message?: string;
      layerId?: string;
      key?: string;
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push(this._build("error", code, opts?.message, opts));
  }

  /** Add a warning diagnostic */
  warn(
    code: RuntimeDiagnosticCode,
    opts?: {
      message?: string;
      layerId?: string;
      key?: string;
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push(this._build("warning", code, opts?.message, opts));
  }

  /** Add an info diagnostic */
  info(
    code: RuntimeDiagnosticCode,
    opts?: {
      message?: string;
      layerId?: string;
      key?: string;
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this._diagnostics.push(this._build("info", code, opts?.message, opts));
  }

  /** Throw if any errors were collected (for fatal cutoff points) */
  throwIfFatal(): void {
    if (this.hasErrors) {
      throw new RuntimeDiagnosticError(
        this._diagnostics.filter((d) => d.severity === "error"),
      );
    }
  }

  /** Clear all diagnostics */
  clear(): void {
    this._diagnostics.length = 0;
  }

  /** Merge diagnostics from another collector */
  merge(other: RuntimeDiagnosticCollector): void {
    this._diagnostics.push(...other._diagnostics);
  }

  private _build(
    severity: DiagnosticSeverity,
    code: RuntimeDiagnosticCode,
    messageOverride?: string,
    opts?: {
      layerId?: string;
      key?: string;
      path?: (string | number)[];
      sourceRef?: string;
      details?: Record<string, unknown>;
    },
  ): RuntimeDiagnostic {
    const meta = RUNTIME_DIAGNOSTIC_CODE_META[code];
    return {
      code,
      message: messageOverride ?? meta.message,
      severity,
      layerId: opts?.layerId,
      key: opts?.key,
      frame: this._frame,
      time: this._time,
      sceneId: this._sceneId,
      path: opts?.path,
      sourceRef: opts?.sourceRef,
      details: opts?.details,
    };
  }
}

// ── Error class ───────────────────────────────────────────────────────

/**
 * Error class wrapping a set of runtime diagnostics.
 * Thrown by `RuntimeDiagnosticCollector.throwIfFatal()`.
 */
export class RuntimeDiagnosticError extends Error {
  readonly diagnostics: readonly RuntimeDiagnostic[];

  constructor(diagnostics: readonly RuntimeDiagnostic[]) {
    super(diagnostics.map((d) => `[${d.code}] ${d.message}`).join("; "));
    this.name = "RuntimeDiagnosticError";
    this.diagnostics = diagnostics;
  }
}

// ── Re-exports for convenience ────────────────────────────────────────

export { type DiagnosticCodeMeta };
