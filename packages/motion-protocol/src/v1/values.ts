/**
 * Schema giá trị JSON V1 — JsonValue, ResolvableValue, VariableReference.
 */
import { z } from "zod";
import { FiniteNumberSchema, IdSchema } from "./common";

export const JsonValueSchema: z.ZodType<
  string | number | boolean | null | Array<unknown> | Record<string, unknown>
> = z.lazy(() =>
  z.union([
    z.string(),
    FiniteNumberSchema,
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const VariableReferenceSchema = z
  .object({
    ref: z.object({ kind: z.literal("variable"), id: IdSchema }),
    map: z
      .object({
        scale: FiniteNumberSchema.optional(),
        offset: FiniteNumberSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ResolvableValueSchema = z.union([
  JsonValueSchema,
  VariableReferenceSchema,
]);

export function isVariableReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isVariableReference);
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.ref !== null &&
    typeof record.ref === "object" &&
    (record.ref as Record<string, unknown>).kind === "variable" &&
    typeof (record.ref as Record<string, unknown>).id === "string"
  )
    return true;
  return Object.values(record).some(isVariableReference);
}

export const LiteralValueSchema = JsonValueSchema.superRefine(
  (value, context) => {
    if (isVariableReference(value))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Runtime values must be literal",
      });
  },
);

export const ValueKindSchema = z.enum([
  "number",
  "angle",
  "vec2",
  "color",
  "boolean",
  "string",
  "asset",
  "path",
  "gradient",
]);
