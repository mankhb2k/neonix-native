/**
 * Phase 12 — Versioning & rollout policy.
 *
 * Central registry of all version constants across the moticlip stack.
 * Each layer has an independent version that evolves on its own schedule.
 *
 * Migration rules:
 *   - MINOR bumps: backward-compatible additions (new fields with defaults, new ops)
 *   - MAJOR bumps: breaking changes (renamed fields, removed ops, changed semantics)
 *   - PATCH bumps: bug fixes with no format change
 *
 * Rollout checklist:
 *   1. Bump the version constant here
 *   2. Update the migration guide in MIGRATION.md
 *   3. Add schema compatibility checks for old files
 *   4. Run full regression (605+ tests)
 *   5. Smoke-test with real project files
 *   6. Deploy editor, worker, and exporter together
 *
 * Feature flags:
 *   Runtime feature flags allow gradual rollout of experimental features.
 *   Set via `motionRuntimeFeatureFlags` on `globalThis` or passed via options.
 */

// ── Layer versions ────────────────────────────────────────────────────

/** Schema format version (authoring and runtime IR — bumped Phase 6) */
export const SCHEMA_FORMAT_VERSION = 3 as const;

/** Project manifest format version */
export const PROJECT_FORMAT_VERSION = 2 as const;

/** Component manifest format version */
export const COMPONENT_FORMAT_VERSION = 2 as const;

/** Patch (diff) format version */
export const PATCH_FORMAT_VERSION = 1 as const;

/** Paint command buffer protocol version */
export const PAINT_COMMAND_VERSION = 1 as const;

/** Composition frame contract version (EvaluatedCompositionFrame) */
export const COMPOSITION_FRAME_VERSION = "3.0.0" as const;

/** Worker protocol version */
export const WORKER_PROTOCOL_VERSION = 1 as const;

/** Render manifest format version */
export const RENDER_MANIFEST_VERSION = 2 as const;

/** Determinism sub-schema version */
export const DETERMINISM_VERSION = 1 as const;

/** Compiler output version (cached compilation) */
export const COMPILER_VERSION = "2.0.0-phase2" as const;

/** Diagnostic contract version */
export const DIAGNOSTIC_VERSION = 1 as const;

/** Cancellation contract version */
export const CANCELLATION_VERSION = 1 as const;

// ── Version manifest (for export / runtime validation) ────────────────

export type RuntimeVersionManifest = {
  /** Schema format version */
  schema: number;
  /** Project format version */
  project: number;
  /** Component format version */
  component: number;
  /** Patch format version */
  patch: number;
  /** Paint command buffer version */
  paintCommand: number;
  /** Composition frame contract version */
  compositionFrame: string;
  /** Worker protocol version */
  workerProtocol: number;
  /** Render manifest version */
  renderManifest: number;
  /** Determinism schema version */
  determinism: number;
  /** Compiler output version */
  compiler: string;
  /** Diagnostic contract version */
  diagnostic: number;
  /** Cancellation contract version */
  cancellation: number;
  /** Feature flags active at export time */
  featureFlags: string[];
};

/**
 * Build a complete version manifest for the current runtime.
 * Useful for embedding in export manifests and worker handshakes.
 */
export function buildVersionManifest(): RuntimeVersionManifest {
  return {
    schema: SCHEMA_FORMAT_VERSION,
    project: PROJECT_FORMAT_VERSION,
    component: COMPONENT_FORMAT_VERSION,
    patch: PATCH_FORMAT_VERSION,
    paintCommand: PAINT_COMMAND_VERSION,
    compositionFrame: COMPOSITION_FRAME_VERSION,
    workerProtocol: WORKER_PROTOCOL_VERSION,
    renderManifest: RENDER_MANIFEST_VERSION,
    determinism: DETERMINISM_VERSION,
    compiler: COMPILER_VERSION,
    diagnostic: DIAGNOSTIC_VERSION,
    cancellation: CANCELLATION_VERSION,
    featureFlags: getActiveFeatureFlags(),
  };
}

// ── Feature flags ─────────────────────────────────────────────────────

/**
 * Feature flags for gradual rollout of experimental features.
 *
 * Usage:
 * ```typescript
 * if (isFeatureEnabled("PERSPECTIVE_3D")) {
 *   // enable 3D rendering
 * }
 * ```
 *
 * Set via:
 *   (globalThis as any).__MOTION_FEATURE_FLAGS__ = ["PERSPECTIVE_3D"];
 *   // or pass via evaluateCompositionFrameV3 opts.featureFlags
 */
export const FeatureFlag = {
  /** Phase 11: Perspective 3D projection */
  PERSPECTIVE_3D: "PERSPECTIVE_3D",
  /** Phase 12: Graceful degradation (diagnostic-driven fallback) */
  GRACEFUL_DEGRADATION: "GRACEFUL_DEGRADATION",
  /** Phase 12: Cancellation support */
  CANCELLATION: "CANCELLATION",
  /** Phase 12: Fuzz protection (clamp non-finite values) */
  FUZZ_PROTECTION: "FUZZ_PROTECTION",
  /** Layer isolation with offscreen buffers */
  LAYER_ISOLATION: "LAYER_ISOLATION",
  /** Motion blur post-processing */
  MOTION_BLUR: "MOTION_BLUR",
  /** Bloom / glow post-processing */
  BLOOM: "BLOOM",
  /** Hardware-accelerated video decode */
  HW_VIDEO_DECODE: "HW_VIDEO_DECODE",
  /** Worker-based frame rendering */
  WORKER_RENDERING: "WORKER_RENDERING",
  /** Remotion export pipeline */
  REMOTION_EXPORT: "REMOTION_EXPORT",
} as const;

export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

/**
 * Default feature flags enabled in production.
 */
export const DEFAULT_FEATURE_FLAGS: readonly FeatureFlag[] = [
  FeatureFlag.GRACEFUL_DEGRADATION,
  FeatureFlag.CANCELLATION,
  FeatureFlag.FUZZ_PROTECTION,
  FeatureFlag.LAYER_ISOLATION,
  FeatureFlag.PERSPECTIVE_3D,
];

/**
 * Check if a feature flag is active.
 * Checks (in order): global override, then passed flags, then defaults.
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  opts?: { featureFlags?: readonly string[] },
): boolean {
  // 1. Global override
  const globals = (
    globalThis as unknown as { __MOTION_FEATURE_FLAGS__?: string[] }
  ).__MOTION_FEATURE_FLAGS__;
  if (globals?.includes(flag)) return true;
  // 2. Passed flags
  if (opts?.featureFlags?.includes(flag)) return true;
  // 3. Default production flags
  if ((DEFAULT_FEATURE_FLAGS as readonly string[]).includes(flag)) return true;
  return false;
}

/**
 * Get the set of currently active feature flags.
 */
export function getActiveFeatureFlags(): string[] {
  const flags = new Set<string>(DEFAULT_FEATURE_FLAGS);
  const globals = (
    globalThis as unknown as { __MOTION_FEATURE_FLAGS__?: string[] }
  ).__MOTION_FEATURE_FLAGS__;
  if (globals) {
    for (const flag of globals) flags.add(flag);
  }
  return Array.from(flags);
}

/**
 * Rollback checklist (to be printed in CI logs):
 * 1. grep for version constants → ensure all match
 * 2. run full test suite (605+ tests)
 * 3. validate acceptance export parity
 * 4. check golden frame hashes
 * 5. verify worker protocol compatibility
 */
export function rollbackChecklist(): string[] {
  return [
    "1. Verify version constants match between runtime and schema",
    "2. Run full test suite: pnpm test",
    "4. Check golden frame hashes: pnpm validate-paint-parity",
    "5. Verify worker protocol compatibility",
    "6. Check render manifest formatVersion",
    "7. Validate paint command buffer version",
  ];
}
