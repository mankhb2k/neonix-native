export const MOTION_PROJECT_FORMAT_VERSION = 3 as const;
export const MOTION_COMPONENT_FORMAT_VERSION = 3 as const;
export const MOTION_PATCH_FORMAT_VERSION = 1 as const;

// ── Re-exported from V3 canonical source of truth ────────────────────
// Runtime consumers still import from "./common" (this file).
// The canonical definitions live in v3/common.ts to avoid divergence.
export {
  AspectRatioSchema,
  IdSchema,
  PropertyPathSchema,
  SemverSchema,
  FiniteNumberSchema,
  LocaleIdentifierSchema,
  SemanticSchema,
  type AspectRatio,
} from "../v3/common";
