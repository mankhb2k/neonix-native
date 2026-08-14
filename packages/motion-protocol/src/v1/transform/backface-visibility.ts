/**
 * backface-visibility: visible | hidden. Key JSON kebab.
 */
import { z } from "zod";

export const BackfaceVisibilitySchema = z.enum(["visible", "hidden"]);

export type BackfaceVisibility = z.infer<typeof BackfaceVisibilitySchema>;
