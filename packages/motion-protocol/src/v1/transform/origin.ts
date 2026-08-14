/**
 * Điểm xoay trong khung layer, 0..1. Chỉ origin.x/y — origin.z không thuộc MVP.
 */
import { z } from "zod";

export const OriginSchema = z
  .object({
    x: z.number().finite().min(0).max(1).default(0.5),
    y: z.number().finite().min(0).max(1).default(0.5),
  })
  .strict();

export type Origin = z.infer<typeof OriginSchema>;
