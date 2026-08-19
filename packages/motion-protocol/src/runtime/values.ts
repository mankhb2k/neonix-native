import { z } from "zod";
import { FiniteNumberSchema, IdSchema } from "./common";
import { JsonValueSchema } from "../v1/values";

// ── Canonical JSON-value schemas live in v1/values.ts (single source of truth).
export {
  JsonValueSchema,
  LiteralValueSchema,
  ValueKindSchema,
  isVariableReference,
} from "../v1/values";

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
