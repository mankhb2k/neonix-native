/**
 * Blend mode JSON kebab: blend-mode.
 */
import { z } from "zod";

export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "add",
  "darken",
  "lighten",
  "overlay",
]);

export type BlendMode = z.infer<typeof BlendModeSchema>;
