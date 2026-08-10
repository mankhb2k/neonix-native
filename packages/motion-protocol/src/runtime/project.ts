/**
 * MotionRuntimeProject — canonical runtime IR types.
 *
 * The runtime schema currently lives in 2/runtime.ts (Phase 2
 * creates this neutral re-export path). Phase 8 will invert the
 * relationship and delete the V2 copy.
 *
 * Canonical names:
 *   MotionRuntimeProject        — the runtime IR type
 *   MotionRuntimeProjectSchema  — Zod schema for validation
 */

// All runtime schemas and types (the actual definitions still in v2)
export {
  NormalizedMotionProjectV2Schema,
  RuntimeCompositionMetadataSchema,
  RuntimeClipSourceSchema,
  RuntimeVisualClipSchema,
  RuntimeVisualTrackSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  MOTION_RUNTIME_VERSION,
  type NormalizedMotionProjectV2,
  type MotionRuntimeIR,
  type MotionRuntimeProject,
  type RuntimeCompositionMetadata,
  type RuntimeClipSource,
  type RuntimeVisualClip,
  type RuntimeVisualTrack,
  type RuntimeSourceRef,
  type RuntimeSourceRefMap,
} from "../v2/runtime";

// Canonical schema alias (same value, better name)
import { NormalizedMotionProjectV2Schema } from "../v2/runtime";
export const MotionRuntimeProjectSchema = NormalizedMotionProjectV2Schema;

// Canonical scene/track sub-types
export type MotionRuntimeScene = MotionRuntimeProject["scenes"][number];
export type MotionRuntimeTrack =
  MotionRuntimeProject["scenes"][number]["tracks"][number];
