export * from "./v2";
export * from "./capabilities";
export * from "./scene-registry";
export * from "./ai-schema-capability";
export * from "./parse-any";
export * as V3 from "./v3";

import {
  parseMotionProjectV3,
  MotionProjectV3Schema,
  serializeMotionProjectV3,
  type MotionProjectV3,
} from "./v3";

/**
 * Phase 1 cutover: canonical type aliases now point to V3.
 *
 * V2 types remain accessible via explicit legacy imports:
 *   `parseMotionProjectV2`, `MotionProjectV2`, `MotionProjectV2Schema`,
 *   `MotionNode`, `MotionScene`, etc. (all re-exported from `./v2` above).
 *
 * Phases 8+ (Editor / AI / Workspace) will update downstream consumers.
 * Phase 12 will delete `./v2` entirely.
 */
export type MotionProject = MotionProjectV3;

export const MotionProjectSchema = MotionProjectV3Schema;
export const MOTION_FORMAT_VERSION = 3 as const;

export function parseMotionProject(input: unknown): MotionProject {
  return parseMotionProjectV3(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV3(project);
}

// Phase 3: explicit V3 API (in addition to the `V3` namespace) so fixtures and
// consumers can import the canonical parse/serialize/schema directly.
export { parseMotionProjectV3, MotionProjectV3Schema, serializeMotionProjectV3 };
export type {
  MotionProjectV3,
  VisualClipV3,
  VisualTrackV3,
  AudioTrackV3,
} from "./v3";
export { migrateMotionProjectV2ToV3 } from "./v3/migrations";
export type { MigrateV2ToV3Options, MigrateV2ToV3Result } from "./v3/migrations";
