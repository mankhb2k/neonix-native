/**
 * Điểm xoay trong khung layer, thường 0..1.
 */
import { z } from "zod";

export const OriginSchema = z
  .object({
    x: z.number().finite().min(0).max(1).default(0.5),
    y: z.number().finite().min(0).max(1).default(0.5),
    z: z.number().finite().min(0).max(1).default(0),
  })
  .strict();

export type Origin = z.infer<typeof OriginSchema>;
