/**
 * Shared V1 JSON Schema artifact builder.
 *
 * Used by `generate-json-schema.ts` (write) and schema-files tests (freshness gate).
 * Keep Zod → JSON Schema options here so script and test cannot diverge.
 *
 * `$refStrategy: "root"` so `z.lazy()` recursive types (`JsonValueSchema`,
 * `ListFieldSchema`) emit `#/definitions/...` instead of falling back to `any`.
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import { MotionProjectV1Schema } from "../src/v1/project";
import {
  ComponentPropValueSchema,
  PropKeyframesValueSchema,
} from "../src/v1/prop-values";
import { JsonValueSchema } from "../src/v1/values";
import { ListFieldSchema } from "../src/v1/variables";

const GENERATE_OPTIONS = {
  name: "MotionProjectV1",
  target: "draft7" as const,
  $refStrategy: "root" as const,
  definitions: {
    JsonValue: JsonValueSchema,
    ListField: ListFieldSchema,
    ComponentPropValue: ComponentPropValueSchema,
    PropKeyframesValue: PropKeyframesValueSchema,
  },
} as unknown as Parameters<typeof zodToJsonSchema>[1];

const JSON_VALUE_DEFINITION = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" },
    { type: "array", items: { $ref: "#/definitions/JsonValue" } },
    {
      type: "object",
      additionalProperties: { $ref: "#/definitions/JsonValue" },
    },
  ],
};

function isOpenJsonSchema(value: unknown): boolean {
  if (value === true) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return true;
  return keys.length === 1 && record.type === true;
}

function patchOpenNamedDefinitions(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const definitions = schema.definitions;
  if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) {
    return schema;
  }
  const defs = definitions as Record<string, unknown>;
  if (isOpenJsonSchema(defs.JsonValue)) {
    defs.JsonValue = JSON_VALUE_DEFINITION;
  }
  return schema;
}

/** Build the Draft-07 JSON Schema document for MotionProjectV1. */
export function buildMotionProjectV1JsonSchema(): unknown {
  const generated = zodToJsonSchema(
    MotionProjectV1Schema,
    GENERATE_OPTIONS,
  ) as Record<string, unknown>;
  return patchOpenNamedDefinitions(generated);
}

/** Serialize deterministically for committed `schema/v1.json`. */
export function serializeMotionProjectV1JsonSchema(): string {
  return `${JSON.stringify(buildMotionProjectV1JsonSchema(), null, 2)}\n`;
}
