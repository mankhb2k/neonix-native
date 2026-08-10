/**
 * V3 composition settings — replaces v2 `metadata.aspectRatio` + `fps`.
 *
 * Dimensions are explicit pixels (no aspect-ratio presets), color space is
 * declared, and motion blur defaults are composition-level.
 */
import { z } from "zod";
import {
  ColorHexSchema,
  NonNegativeIntegerSchema,
  NormalizedRatioSchema,
  PositiveNumberSchema,
} from "./common";

export const SafeAreaSchema = z
  .object({
    top: NormalizedRatioSchema,
    right: NormalizedRatioSchema,
    bottom: NormalizedRatioSchema,
    left: NormalizedRatioSchema,
  })
  .strict();

export type SafeArea = z.infer<typeof SafeAreaSchema>;

export const MotionBlurDefaultsSchema = z
  .object({
    samples: NonNegativeIntegerSchema.max(64).default(8),
    shutterAngle: PositiveNumberSchema.max(360).default(180),
    shutterPhase: NormalizedRatioSchema.default(0),
  })
  .strict();

export type MotionBlurDefaults = z.infer<typeof MotionBlurDefaultsSchema>;

export const CompositionSettingsSchema = z
  .object({
    width: NonNegativeIntegerSchema.refine((v) => v > 0, {
      message: "width must be > 0",
    }),
    height: NonNegativeIntegerSchema.refine((v) => v > 0, {
      message: "height must be > 0",
    }),
    fps: PositiveNumberSchema.refine((v) => v >= 1 && v <= 120, {
      message: "fps must be within [1, 120]",
    }),
    background: ColorHexSchema.default("#ffffff"),
    colorSpace: z.literal("srgb").default("srgb"),
    pixelAspectRatio: PositiveNumberSchema.optional(),
    audioSampleRate: z
      .union([z.literal(44100), z.literal(48000)])
      .default(48000),
    safeArea: SafeAreaSchema.optional(),
    motionBlur: MotionBlurDefaultsSchema.optional(),
  })
  .strict();

export type CompositionSettings = z.infer<typeof CompositionSettingsSchema>;
