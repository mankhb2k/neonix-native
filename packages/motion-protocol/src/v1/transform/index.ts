/**
 * Ghép atom hình học. MVP 2.5D: translate + depth, không true 3D.
 *
 * Giữ: translate.x/y, depth, rotate.z, scale.x/y, skew.x/y, origin.x/y.
 * depth > 0 gần người xem; < 0 xa hơn; 0 mặt phẳng thường. Không phải zIndex.
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
    rotate: RotateSchema.default({ z: 0 }),
    scale: ScaleSchema.default({ x: 1, y: 1 }),
    skew: SkewSchema.default({ x: 0, y: 0 }),
    origin: OriginSchema.default({ x: 0.5, y: 0.5 }),
    depth: DepthSchema.default(0),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformSchema>;
