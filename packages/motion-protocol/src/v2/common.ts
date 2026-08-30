import { z } from "zod";

export const V2IdSchema = z.string().min(1).max(200);
export const V2FiniteNumberSchema = z.number().finite();
export const V2PositiveNumberSchema = V2FiniteNumberSchema.positive();
export const V2NonNegativeNumberSchema = V2FiniteNumberSchema.nonnegative();
/** Protocol temporal values are milliseconds. Fractional milliseconds are allowed. */
export const V2MillisecondsSchema = V2NonNegativeNumberSchema;
export const V2PositiveMillisecondsSchema = V2PositiveNumberSchema;
export const V2ColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i, "Expected #RRGGBB or #RRGGBBAA");
