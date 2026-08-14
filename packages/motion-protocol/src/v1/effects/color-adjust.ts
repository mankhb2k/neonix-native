/**
 * Grade màu trên pixel layer này. Identity: 100/100/100, hue-rotate 0.
 * Không phải adjustment layer (grade cho layer phía dưới).
 */
import { z } from "zod";
import { IdSchema } from "../common";
import {
  ColorAdjustPercentSchema,
  HueRotateSchema,
} from "../common";

export const ColorAdjustEffectSchema = z
  .object({
    id: IdSchema,
    type: z.literal("color-adjust"),
    brightness: ColorAdjustPercentSchema.default(100),
    contrast: ColorAdjustPercentSchema.default(100),
    saturation: ColorAdjustPercentSchema.default(100),
    "hue-rotate": HueRotateSchema.default(0),
  })
  .strict();

export type ColorAdjustEffect = z.infer<typeof ColorAdjustEffectSchema>;
