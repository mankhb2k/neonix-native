/**
 * Ghép appearance: visible + opacity. Import file lá để test từng atom.
 */
import { z } from "zod";
import { OpacitySchema } from "./opacity";
import { VisibilitySchema } from "./visibility";

export const AppearanceSchema = z
  .object({
    visible: VisibilitySchema.default(true),
    opacity: OpacitySchema.default(100),
  })
  .strict();

export type MotionAppearance = z.infer<typeof AppearanceSchema>;
