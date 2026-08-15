/**
 * Ghép compositing: blend-mode, isolation, mask.
 */
import { z } from "zod";
import { BlendModeSchema } from "./blend-mode";
import { IsolationSchema } from "./isolation";
import { LayerMaskSchema } from "./mask";

export const CompositingSchema = z
  .object({
    "blend-mode": BlendModeSchema.default("normal"),
    isolation: IsolationSchema.default("auto"),
    mask: LayerMaskSchema.optional(),
  })
  .strict();

export type MotionCompositing = z.infer<typeof CompositingSchema>;
