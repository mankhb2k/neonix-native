/**
 * Ghép compositing: blend-mode, mask (core).
 */
import { z } from "zod";
import { BlendModeSchema } from "./blend-mode";
import { LayerMaskSchema } from "./mask";

export const CompositingSchema = z
  .object({
    "blend-mode": BlendModeSchema.default("normal"),
    mask: LayerMaskSchema.optional(),
  })
  .strict();

export type MotionCompositing = z.infer<typeof CompositingSchema>;
