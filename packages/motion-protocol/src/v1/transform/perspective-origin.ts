/**
 * Gốc phối cảnh { x, y } (0..1). Key JSON: perspective-origin.
 */
import { z } from "zod";

export const PerspectiveOriginSchema = z
  .object({
    x: z.number().finite().min(0).max(1).default(0.5),
    y: z.number().finite().min(0).max(1).default(0.5),
  })
  .strict();

export type PerspectiveOrigin = z.infer<typeof PerspectiveOriginSchema>;
