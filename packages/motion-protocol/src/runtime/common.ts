import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";

export const MOTION_PROJECT_FORMAT_VERSION = 3 as const;
export const MOTION_COMPONENT_FORMAT_VERSION = 3 as const;
export const MOTION_PATCH_FORMAT_VERSION = 1 as const;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const IdSchema = z.string().min(1).max(MOTION_PROTOCOL_LIMITS.idLength);
export const PropertyPathSchema = z.string().min(1);
export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Expected semantic version");
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
