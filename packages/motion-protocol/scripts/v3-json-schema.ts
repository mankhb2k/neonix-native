/**
 * Shared V3 JSON Schema artifact builder.
 *
 * Used by `generate-json-schema.ts` (write) and schema-files tests (freshness gate).
 * Keep Zod → JSON Schema options here so script and test cannot diverge.
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import { MotionProjectV3Schema } from "../src/v3/project";

const GENERATE_OPTIONS = {
  name: "MotionProjectV3",
  target: "draft7" as const,
  $refStrategy: "none" as const,
} as unknown as Parameters<typeof zodToJsonSchema>[1];

/** Build the Draft-07 JSON Schema document for MotionProjectV3. */
export function buildMotionProjectV3JsonSchema(): unknown {
  return zodToJsonSchema(MotionProjectV3Schema, GENERATE_OPTIONS);
}

/** Serialize deterministically for committed `schema/v3.json`. */
export function serializeMotionProjectV3JsonSchema(): string {
  return `${JSON.stringify(buildMotionProjectV3JsonSchema(), null, 2)}\n`;
}
