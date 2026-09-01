import { z } from "zod";

export const V2IdSchema = z.string().min(1).max(200);
export const V2FiniteNumberSchema = z.number().finite();
export const V2PositiveNumberSchema = V2FiniteNumberSchema.positive();
export const V2NonNegativeNumberSchema = V2FiniteNumberSchema.nonnegative();
/** Protocol temporal values are milliseconds. Fractional milliseconds are allowed. */
export const V2MillisecondsSchema = V2NonNegativeNumberSchema;
export const V2PositiveMillisecondsSchema = V2PositiveNumberSchema;

/** SVG paint-order components. Unlisted components are appended by the runtime in SVG default order. */
export const V2PaintOrderItemSchema = z.enum(["fill", "stroke", "markers"]);
export const V2PaintOrderSchema = z
  .array(V2PaintOrderItemSchema)
  .min(1)
  .max(3)
  .superRefine((items, ctx) => {
    if (new Set(items).size !== items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "paintOrder items must be unique",
      });
    }
  });
export type V2PaintOrderItem = z.infer<typeof V2PaintOrderItemSchema>;
export type V2PaintOrder = z.infer<typeof V2PaintOrderSchema>;
export const V2ColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i, "Expected #RRGGBB or #RRGGBBAA");
