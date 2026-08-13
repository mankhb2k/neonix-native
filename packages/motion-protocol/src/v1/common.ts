/**
 * V1 shared primitives — canonical source of truth for common schemas.
 *
 * Previously re-exported from legacy/common. Phase 2 moves ownership here
 * so V1 modules no longer depend on legacy/.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";

export const MOTION_PROJECT_V1_FORMAT_VERSION = 1 as const;
export const MOTION_WORKSPACE_FORMAT_VERSION = 1 as const;

// ── Primitives (copied from legacy/common — same definitions) ─────────

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const IdSchema = z.string().min(1).max(MOTION_PROTOCOL_LIMITS.idLength);
export const PropertyPathSchema = z.string().min(1);
export const SemverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/,
    "Expected semantic version",
  );
export const FiniteNumberSchema = z.number().finite();
export const LocaleIdentifierSchema = z
  .string()
  .min(1)
  .refine((locale) => {
    try {
      return Intl.getCanonicalLocales(locale).length === 1;
    } catch {
      return false;
    }
  }, "Invalid locale identifier");

export const SemanticSchema = z
  .object({
    role: IdSchema,
    key: IdSchema.optional(),
    tags: z
      .array(IdSchema)
      .max(MOTION_PROTOCOL_LIMITS.semanticTags)
      .default([]),
  })
  .strict();

export type AspectRatio = z.infer<typeof AspectRatioSchema>;

/** #rrggbb (6 hex digits). */
export const ColorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb hex color");

export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const PositiveNumberSchema = z.number().positive().finite();
export const NormalizedRatioSchema = z.number().min(0).max(1).finite();
