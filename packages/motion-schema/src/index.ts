import { z } from "zod";

/** MotionVideo Motion Format (`.mt`) — bump when breaking project shape. */
export const MOTION_FORMAT_VERSION = 1 as const;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const LayerTypeSchema = z.enum([
  "text",
  "image",
  "shape",
  "logo",
  "character",
  "icon",
]);

export const EasingSchema = z.enum([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "spring",
]);

/**
 * Structural animation shape only.
 * Which preset IDs the product supports lives in `@motionvideo/template-library`
 * (`validateMotionProjectPresets` / block registry) — not here.
 */
export const AnimationSchema = z.object({
  /** Preset id (e.g. `fade-up`). Registry decides if known. */
  preset: z.string().min(1),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  /** Optional — engine default 0 */
  delay: z.number().nonnegative().optional(),
  /** Optional — engine default easeOut */
  easing: EasingSchema.optional(),
  /**
   * Open bag for preset-specific knobs (camera target, counter from/to, …).
   * Unused in MVP — reserved so new presets do not break the schema.
   */
  params: z.record(z.string(), z.unknown()).optional(),
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
  /** Format version — required for long-lived `.mt` files. */
  version: z.literal(MOTION_FORMAT_VERSION).default(MOTION_FORMAT_VERSION),
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
export type Animation = z.infer<typeof AnimationSchema>;
/** @deprecated Use string; registry owns known presets. Kept as alias for callers. */
export type AnimationPreset = string;
export type Layer = z.infer<typeof LayerSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type MotionProject = z.infer<typeof MotionProjectSchema>;

export class MotionFormatVersionError extends Error {
  constructor(
    public readonly found: unknown,
    public readonly expected: typeof MOTION_FORMAT_VERSION = MOTION_FORMAT_VERSION,
  ) {
    super(
      `Unsupported Motion Format version: expected ${expected}, got ${String(found)}`,
    );
    this.name = "MotionFormatVersionError";
  }
}

/**
 * Parse / validate structural Motion JSON (`.mt` body).
 * Does **not** check whether presets exist — use template-library for that.
 */
export function parseMotionProject(input: unknown): MotionProject {
  if (
    input !== null &&
    typeof input === "object" &&
    "version" in input &&
    (input as { version: unknown }).version !== undefined &&
    (input as { version: unknown }).version !== MOTION_FORMAT_VERSION
  ) {
    throw new MotionFormatVersionError((input as { version: unknown }).version);
  }
  return MotionProjectSchema.parse(input);
}

/** Serialize a project for `.mt` / storage (always includes `version`). */
export function serializeMotionProject(project: MotionProject): string {
  const withVersion: MotionProject = {
    ...project,
    version: MOTION_FORMAT_VERSION,
  };
  return `${JSON.stringify(withVersion, null, 2)}\n`;
}
