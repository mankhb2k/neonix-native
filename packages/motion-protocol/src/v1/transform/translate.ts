/**
 * Tịnh tiến { x, y }. Không có z (depth nằm transform.depth).
 */
import { z } from "zod";

export const TranslateSchema = z
  .object({
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
  })
  .strict();

export type Translate = z.infer<typeof TranslateSchema>;
