export * from "./v2";
export * from "./capabilities";
export * from "./scene-registry";
export * from "./ai-schema-capability";
export * as V3 from "./v3";

// Canonical runtime schema aliases (Phase 2 — neutralized location).
// The actual schema still lives in v2/runtime.ts; these are forward-looking
// names that will become the only names after Phase 8 file deletion.
export {
  MotionRuntimeProjectSchema,
  type MotionRuntimeScene,
  type MotionRuntimeTrack,
} from "./runtime";

// Phase 11: canonical hash functions are version-agnostic, export directly.
export {
  canonicalJson,
  computeProjectHash,
  computeProjectHashShort,
  computeRuntimeHash,
  computeContentHash,
  deepSortKeys,
  shortHash,
  hashesMatch,
  buildCapabilityFingerprint,
  RENDER_MANIFEST_VERSION,
} from "./v3/canonical-hash";

import {
  parseMotionProjectV3,
  MotionProjectV3Schema,
  serializeMotionProjectV3,
  type MotionProjectV3,
} from "./v3";

/** V2 is no longer accepted. parseMotionProject only accepts V3. */
export type MotionProject = MotionProjectV3;

export const MotionProjectSchema = MotionProjectV3Schema;
export const MOTION_FORMAT_VERSION = 3 as const;

/**
 * Parse a motion project JSON payload. Only formatVersion 3 is accepted.
 * formatVersion 2 inputs are rejected with a clear error.
 */
export function parseMotionProject(input: unknown): MotionProject {
  if (
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as Record<string, unknown>).formatVersion === 2
  ) {
    throw new Error(
      "V2 motion projects are no longer supported. " +
        "Please migrate your project to V3 using the legacy migration helper " +
        "in packages/motion-protocol/src/v3/migrations/v2-to-v3.",
    );
  }
  return parseMotionProjectV3(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV3(project);
}

// Explicit V3 API (in addition to the `V3` namespace) so fixtures and
// consumers can import the canonical parse/serialize/schema directly.
export {
  parseMotionProjectV3,
  MotionProjectV3Schema,
  serializeMotionProjectV3,
};
export type {
  MotionProjectV3,
  VisualClipV3,
  VisualTrackV3,
  AudioTrackV3,
} from "./v3";
