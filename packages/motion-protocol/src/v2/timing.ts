import { z } from "zod";
import { V2NonNegativeNumberSchema, V2PositiveNumberSchema } from "./common";

export const V2TimingSchema = z
  .object({
    start: V2NonNegativeNumberSchema,
    duration: V2PositiveNumberSchema,
  })
  .strict();

export type V2Timing = z.infer<typeof V2TimingSchema>;
