/**
 * Lớp hiển thị tối thiểu của visual layer: visible + opacity.
 * Không chứa compositing, effect, hay interaction / hit-test.
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
