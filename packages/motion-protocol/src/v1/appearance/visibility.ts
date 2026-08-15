/**
 * Hiện/ẩn layer (boolean).
 */
import { z } from "zod";

export const VisibilitySchema = z.boolean();

export type Visibility = z.infer<typeof VisibilitySchema>;
