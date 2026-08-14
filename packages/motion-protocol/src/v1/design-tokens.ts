/**
 * Design token V1 trên project.tokens (màu, font, spacing, radii, motion).
 *
 * Khác variables: token là bản tra cứu; variable là giá trị instance để binding.
 */
import { z } from "zod";
import { FiniteNumberSchema, NormalizedRatioSchema } from "./common";

export const DesignTokensSchema = z
  .object({
    colors: z.record(z.string().min(1).max(64)).optional(),
    fonts: z.record(z.string().min(1).max(128)).optional(),
    spacing: z.record(FiniteNumberSchema).optional(),
    radii: z.record(NormalizedRatioSchema).optional(),
    motion: z.record(FiniteNumberSchema).optional(),
  })
  .strict();

export type DesignTokens = z.infer<typeof DesignTokensSchema>;
