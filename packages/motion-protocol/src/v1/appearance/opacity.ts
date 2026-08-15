/**
 * Độ mờ render 0..100 nguyên, 100 = đầy. Không phải filter hay hit-test.
 * Opacity cha có thể cộng hưởng xuống con. Paint dùng ratioFromPercent.
 */
import { z } from "zod";
import { PercentSchema } from "../common";

export const OpacitySchema = PercentSchema;

export type Opacity = z.infer<typeof OpacitySchema>;
