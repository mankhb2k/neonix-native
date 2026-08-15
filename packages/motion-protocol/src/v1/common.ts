/**
 * Primitive dùng chung V1 — nguồn sự thật cho schema cơ bản.
 *
 * Gồm PercentSchema (0..100), ColorAdjustPercentSchema (0..200),
 * HueRotateSchema (−180..180) và ratioFromPercent.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";

export const MOTION_PROJECT_V1_FORMAT_VERSION = 1 as const;
export const MOTION_WORKSPACE_FORMAT_VERSION = 1 as const;

// ── Primitive dùng chung ─────────────────────────────────────────────

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

/** Màu #rrggbb (6 hex). */
export const ColorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb hex color");

export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const PositiveNumberSchema = z.number().positive().finite();
export const NormalizedRatioSchema = z.number().min(0).max(1).finite();

/** Phần trăm authoring. 100 = đầy (opacity, volume). Chỉ số nguyên. */
export const PercentSchema = z.number().int().min(0).max(100);

/** Phần trăm color-adjust. 100 = bình thường, 200 = 2×. Chỉ số nguyên. */
export const ColorAdjustPercentSchema = z.number().int().min(0).max(200);

/** hue-rotate theo độ. */
export const HueRotateSchema = z.number().finite().min(-180).max(180);

/** Paint/audio: phần trăm authoring → 0..1 (hoặc 0..2 với color-adjust). */
export function ratioFromPercent(percent: number): number {
  return percent / 100;
}
