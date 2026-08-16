/**
 * Điểm neo transform trong box local, normalized 0..1.
 * Canonical AI: 0 | 0.5 | 1 (góc / tâm). Schema vẫn nhận mọi giá trị 0..1 để nội suy.
 * origin.z không thuộc V1.
 */
import { z } from "zod";

export const OriginSchema = z
  .object({
    x: z.number().finite().min(0).max(1).default(0.5),
    y: z.number().finite().min(0).max(1).default(0.5),
  })
  .strict();

export type Origin = z.infer<typeof OriginSchema>;
