/**
 * Ghép atom hình học thành TransformSchema. Không re-export atom — import file lá.
 */
import { z } from "zod";
import { TranslateSchema } from "./translate";
import { RotateSchema } from "./rotate";
import { ScaleSchema } from "./scale";
import { SkewSchema } from "./skew";
import { OriginSchema } from "./origin";
import { PerspectiveSchema } from "./perspective";
import { PerspectiveOriginSchema } from "./perspective-origin";
import { TransformStyleSchema } from "./transform-style";
import { BackfaceVisibilitySchema } from "./backface-visibility";
import { DepthSchema } from "./depth";

export const TransformSchema = z
  .object({
    translate: TranslateSchema.default({ x: 0, y: 0 }),
    rotate: RotateSchema.default({ x: 0, y: 0, z: 0 }),
    scale: ScaleSchema.default({ x: 1, y: 1, z: 1 }),
    skew: SkewSchema.default({ x: 0, y: 0 }),
    origin: OriginSchema.default({ x: 0.5, y: 0.5, z: 0 }),
    depth: DepthSchema.default(0),
    perspective: PerspectiveSchema.optional(),
    "perspective-origin": PerspectiveOriginSchema.optional(),
    "transform-style": TransformStyleSchema.default("flat"),
    "backface-visibility": BackfaceVisibilitySchema.default("visible"),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformSchema>;
