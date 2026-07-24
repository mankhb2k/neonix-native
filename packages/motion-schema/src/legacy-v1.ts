import { z } from "zod";

export const MOTION_FORMAT_VERSION_V1 = 1 as const;

export const AspectRatioV1Schema = z.enum(["9:16", "16:9", "1:1"]);
export const LayerTypeV1Schema = z.enum(["text", "image", "shape", "logo", "character", "icon"]);
export const EasingV1Schema = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring"]);

export const AnimationV1Schema = z.object({
  preset: z.string().min(1),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  delay: z.number().nonnegative().optional(),
  easing: EasingV1Schema.optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const LayerV1Schema = z.object({
  id: z.string().min(1),
  type: LayerTypeV1Schema,
  content: z.string().optional(),
  assetId: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  animations: z.array(AnimationV1Schema).default([]),
});

export const SceneV1Schema = z.object({
  id: z.string().min(1),
  role: z.enum(["hook", "pain", "benefit", "demo", "offer", "cta", "logo"]).optional(),
  duration: z.number().positive(),
  layers: z.array(LayerV1Schema),
});

export const BrandV1Schema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoAssetId: z.string().optional(),
  fontFamily: z.string().optional(),
});

export const MotionProjectV1Schema = z.object({
  version: z.literal(MOTION_FORMAT_VERSION_V1).default(MOTION_FORMAT_VERSION_V1),
  id: z.string().min(1),
  locale: z.literal("vi-VN").default("vi-VN"),
  aspectRatio: AspectRatioV1Schema.default("9:16"),
  industry: z.string().optional(),
  brand: BrandV1Schema,
  scenes: z.array(SceneV1Schema).min(1),
  voiceoverUrl: z.string().url().optional(),
  musicAssetId: z.string().optional(),
});

export type MotionProjectV1 = z.infer<typeof MotionProjectV1Schema>;
export type SceneV1 = z.infer<typeof SceneV1Schema>;
export type LayerV1 = z.infer<typeof LayerV1Schema>;

export function parseMotionProjectV1(input: unknown): MotionProjectV1 {
  return MotionProjectV1Schema.parse(input);
}

export function serializeMotionProjectV1(project: MotionProjectV1): string {
  return `${JSON.stringify({ ...project, version: MOTION_FORMAT_VERSION_V1 }, null, 2)}\n`;
}
