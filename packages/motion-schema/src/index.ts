import { z } from "zod";

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const AnimationPresetSchema = z.enum([
  "fade",
  "fade-up",
  "slide-left",
  "slide-right",
  "scale",
  "logo-reveal",
  "price-pop",
  "cta-slide",
]);

export const LayerTypeSchema = z.enum([
  "text",
  "image",
  "shape",
  "logo",
  "character",
  "icon",
]);

export const AnimationSchema = z.object({
  preset: AnimationPresetSchema,
  start: z.number().nonnegative(),
  duration: z.number().positive(),
});

export const LayerSchema = z.object({
  id: z.string().min(1),
  type: LayerTypeSchema,
  content: z.string().optional(),
  assetId: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  animations: z.array(AnimationSchema).default([]),
});

export const SceneSchema = z.object({
  id: z.string().min(1),
  role: z
    .enum(["hook", "pain", "benefit", "demo", "offer", "cta", "logo"])
    .optional(),
  duration: z.number().positive(),
  layers: z.array(LayerSchema),
});

export const BrandSchema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoAssetId: z.string().optional(),
  fontFamily: z.string().optional(),
});

export const MotionProjectSchema = z.object({
  id: z.string().min(1),
  locale: z.literal("vi-VN").default("vi-VN"),
  aspectRatio: AspectRatioSchema.default("9:16"),
  industry: z.string().optional(),
  brand: BrandSchema,
  scenes: z.array(SceneSchema).min(1),
  voiceoverUrl: z.string().url().optional(),
  musicAssetId: z.string().optional(),
});

export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type AnimationPreset = z.infer<typeof AnimationPresetSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type MotionProject = z.infer<typeof MotionProjectSchema>;

export function parseMotionProject(input: unknown): MotionProject {
  return MotionProjectSchema.parse(input);
}
