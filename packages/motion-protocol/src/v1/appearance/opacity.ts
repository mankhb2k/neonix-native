/**
 * Opacity compositing cuối — không phải filter.
 * Authoring 0..100 nguyên, 100 = đầy. Paint dùng ratioFromPercent.
 */
import { z } from "zod";
import { PercentSchema } from "../common";

export const OpacitySchema = PercentSchema;

export type Opacity = z.infer<typeof OpacitySchema>;
