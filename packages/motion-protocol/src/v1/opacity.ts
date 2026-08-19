/**
 * Opacity render 0..100 integer, 100 = full. Parent opacity cascades to children.
 */
import { z } from "zod";
import { PercentSchema } from "./common";

export const OpacitySchema = PercentSchema;

export type Opacity = z.infer<typeof OpacitySchema>;
