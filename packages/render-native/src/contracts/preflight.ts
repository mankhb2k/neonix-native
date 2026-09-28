/**
 * Preflight — capability validation before export.
 *
 * §Phase 10 Task 10.6 in core-engine-tasks.md
 *
 * Validates that the current environment meets all capability
 * requirements declared by the project. Rejects non-production
 * capabilities during export to prevent degraded output.
 */

// ── Capability types ──────────────────────────────────────────────────

export type ExportCapability = {
  /** Unique capability ID. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Whether this capability is required for production export. */
  productionRequired: boolean;
  /** Current availability. */
  available: boolean;
  /** Optional reason if unavailable. */
  reason?: string;
};

export type CapabilityCategory =
  | "codec"
  | "pixelFormat"
  | "backingStore"
  | "offscreen"
  | "shader"
  | "font"
  | "memory"
  | "audio";

export type PreflightCapability = {
  id: string;
  category: CapabilityCategory;
  label: string;
  productionRequired: boolean;
  /** Minimum version string (semver). */
  minVersion?: string;
  /** Current version string (semver). */
  currentVersion?: string;
  available: boolean;
  reason?: string;
};

export type PreflightResult = {
  /** Whether all production-required capabilities are met. */
  passed: boolean;
  /** Whether production-ready (all required caps available). */
  productionReady: boolean;
  /** All capabilities checked. */
  capabilities: PreflightCapability[];
  /** Capabilities that failed (production-required but unavailable). */
  failures: PreflightCapability[];
  /** Capabilities that are degraded (available but not optimal). */
  warnings: PreflightCapability[];
  /** ISO timestamp of the check. */
  checkedAt: string;
  /** Environment info for diagnostics. */
  environment: {
    platform: string;
    browser?: string;
    renderer?: string;
    codecSupport: string[];
    maxTextureSize: number;
    audioContextAvailable: boolean;
  };
};

// ── Built-in capability checks ────────────────────────────────────────

/**
 * Check WebCodecs availability for video encoding.
 */
export function checkWebCodecs(): PreflightCapability {
  const available =
    typeof globalThis !== "undefined" &&
    "VideoEncoder" in globalThis &&
    "AudioEncoder" in globalThis;
  return {
    id: "webcodecs",
    category: "codec",
    label: "WebCodecs API",
    productionRequired: true,
    available,
    reason: available
      ? undefined
      : "WebCodecs API not available in this runtime",
  };
}

/**
 * Check OffscreenCanvas availability for worker rendering.
 */
export function checkOffscreenCanvas(): PreflightCapability {
  const available =
    typeof globalThis !== "undefined" && "OffscreenCanvas" in globalThis;
  return {
    id: "offscreen-canvas",
    category: "offscreen",
    label: "OffscreenCanvas",
    productionRequired: true,
    available,
    reason: available
      ? undefined
      : "OffscreenCanvas not available — worker rendering disabled",
  };
}

/**
 * Check WebGL2 availability for shader-based effects.
 */
export function checkWebGL2(): PreflightCapability {
  const available =
    typeof globalThis !== "undefined" && "WebGL2RenderingContext" in globalThis;
  return {
    id: "webgl2",
    category: "shader",
    label: "WebGL 2.0",
    productionRequired: false,
    available,
    reason: available
      ? undefined
      : "WebGL 2.0 not available — GPU effects degraded",
  };
}

/**
 * Check AudioContext availability.
 */
export function checkAudioContext(): PreflightCapability {
  const available =
    typeof globalThis !== "undefined" &&
    ("AudioContext" in globalThis || "webkitAudioContext" in globalThis);
  return {
    id: "audio-context",
    category: "audio",
    label: "Web Audio API",
    productionRequired: true,
    available,
    reason: available
      ? undefined
      : "Web Audio API not available — audio export disabled",
  };
}

/**
 * Check that a list of codec strings are supported.
 */
export function checkCodecSupport(
  requiredCodecs: string[],
  supportedCodecs: string[],
): PreflightCapability[] {
  return requiredCodecs.map((codec) => ({
    id: `codec-${codec}`,
    category: "codec" as CapabilityCategory,
    label: `Codec: ${codec}`,
    productionRequired: true,
    available: supportedCodecs.includes(codec),
    reason: supportedCodecs.includes(codec)
      ? undefined
      : `Codec "${codec}" not supported in this environment`,
  }));
}

/**
 * Check maximum texture size against requirement.
 */
export function checkTextureSize(
  maxSize: number,
  requiredSize: number,
): PreflightCapability {
  const available = maxSize >= requiredSize;
  return {
    id: "texture-size",
    category: "backingStore",
    label: `Max Texture Size (${requiredSize}px required)`,
    productionRequired: true,
    available,
    reason: available
      ? undefined
      : `Max texture size ${maxSize}px < required ${requiredSize}px`,
  };
}

/**
 * Check available memory (MB).
 */
export function checkMemory(
  availableMb: number,
  requiredMb: number,
): PreflightCapability {
  const available = availableMb >= requiredMb;
  return {
    id: "memory",
    category: "memory",
    label: `Memory (${requiredMb}MB required)`,
    productionRequired: false,
    available,
    reason: available
      ? undefined
      : `Available memory ${availableMb}MB < required ${requiredMb}MB`,
  };
}

// ── Preflight runner ──────────────────────────────────────────────────

export type PreflightOptions = {
  /** Required codecs for export. */
  requiredCodecs?: string[];
  /** Required max texture size. */
  requiredTextureSize?: number;
  /** Required memory (MB). */
  requiredMemoryMb?: number;
  /** Whether to treat warnings as failures. */
  strict?: boolean;
};

export function runPreflight(
  env: PreflightResult["environment"],
  opts: PreflightOptions = {},
): PreflightResult {
  const capabilities: PreflightCapability[] = [
    checkWebCodecs(),
    checkOffscreenCanvas(),
    checkWebGL2(),
    checkAudioContext(),
    checkTextureSize(env.maxTextureSize, opts.requiredTextureSize ?? 4096),
    checkMemory(
      typeof performance !== "undefined" &&
        "memory" in performance &&
        (performance as { memory?: { jsHeapSizeLimit: number } }).memory
        ? Math.round(
            (performance as { memory: { jsHeapSizeLimit: number } }).memory
              .jsHeapSizeLimit /
              1024 /
              1024,
          )
        : 2048,
      opts.requiredMemoryMb ?? 512,
    ),
    ...checkCodecSupport(
      opts.requiredCodecs ?? ["avc1", "aac"],
      env.codecSupport,
    ),
  ];

  const failures = capabilities.filter(
    (c) => c.productionRequired && !c.available,
  );
  const warnings = capabilities.filter(
    (c) => !c.productionRequired && !c.available && (!opts.strict || true),
  );

  const passed = failures.length === 0;
  const strictPassed = opts.strict ? passed && warnings.length === 0 : passed;

  return {
    passed: strictPassed,
    productionReady: passed,
    capabilities,
    failures,
    warnings,
    checkedAt: new Date().toISOString(),
    environment: env,
  };
}
