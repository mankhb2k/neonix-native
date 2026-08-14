/**
 * Mask clip — sourceLayerId + source-visibility.
 */
import { z } from "zod";
import { IdSchema } from "../common";

export const LayerMaskSchema = z
  .object({
    sourceLayerId: IdSchema,
    mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
    "source-visibility": z.enum(["mask-only", "content-and-mask"]),
  })
  .strict();

export type LayerMask = z.infer<typeof LayerMaskSchema>;
