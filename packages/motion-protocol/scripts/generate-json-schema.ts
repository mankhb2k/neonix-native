/**
 * Generates JSON Schema (Draft-07) for the v3 motion-project format.
 *
 * Usage: pnpm generate:schema  (runs `tsx scripts/generate-json-schema.ts`)
 *
 * Writes `schema/v3.json` deterministically.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MotionProjectV3Schema } from "../src/v3/index";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA_DIR = join(ROOT, "schema");
if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

const v3Schema = zodToJsonSchema(MotionProjectV3Schema, {
  name: "MotionProjectV3",
  target: "draft7",
  $refStrategy: "none",
});

writeFileSync(
  join(SCHEMA_DIR, "v3.json"),
  `${JSON.stringify(v3Schema, null, 2)}\n`,
  "utf8",
);

console.log("Generated schema/v3.json");
