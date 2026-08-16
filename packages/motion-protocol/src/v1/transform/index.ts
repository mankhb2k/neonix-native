/**
 * Ghép atom hình học. Cùng một `transform` cho mọi visual layer.
 *
 * Pipeline: frame → origin → scale/rotate/skew → translate + depth.
 * Không phải layout, timing, effect, hay paint order (zIndex).
 */
import { z } from "zod";
import { TranslateSchema } from "./translate";
import { RotateSchema } from "./rotate";
import { ScaleSchema } from "./scale";
import { SkewSchema } from "./skew";
import { OriginSchema } from "./origin";
import { DepthSchema } from "./depth";

export const TransformSchema = z
  .object({
    translate: TranslateSchema.default({ x: 0, y: 0 }),
    scale: ScaleSchema.default({ x: 1, y: 1 }),
    rotate: RotateSchema.default({ z: 0 }),
    skew: SkewSchema.default({ x: 0, y: 0 }),
    origin: OriginSchema.default({ x: 0.5, y: 0.5 }),
    depth: DepthSchema.default(0),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformSchema>;
