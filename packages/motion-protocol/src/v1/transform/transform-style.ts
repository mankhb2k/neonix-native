/**
 * transform-style: flat | preserve-3d. Key JSON kebab.
 */
import { z } from "zod";

export const TransformStyleSchema = z.enum(["flat", "preserve-3d"]);

export type TransformStyle = z.infer<typeof TransformStyleSchema>;
