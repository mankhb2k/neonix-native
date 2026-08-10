/**
 * Generates JSON Schema (Draft-07) for the v2 and v3 motion-project formats.
 *
 * Usage:
 *   node scripts/generate-json-schema.mjs
 *
 * Writes `schema/v2.json` and `schema/v3.json` deterministically.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MotionProjectV2Schema } from "../src/v2/project.js";
import { MotionProjectV3Schema } from "../src/v3/index.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA_DIR = join(ROOT, "schema");
if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

const v2Schema = zodToJsonSchema(MotionProjectV2Schema, {
  name: "MotionProjectV2",
  target: "draft7",
  $refStrategy: "none",
});

const v3Schema = zodToJsonSchema(MotionProjectV3Schema, {
  name: "MotionProjectV3",
  target: "draft7",
  $refStrategy: "none",
});

writeFileSync(join(SCHEMA_DIR, "v2.json"), `${JSON.stringify(v2Schema, null, 2)}\n`, "utf8");
writeFileSync(join(SCHEMA_DIR, "v3.json"), `${JSON.stringify(v3Schema, null, 2)}\n`, "utf8");

console.log("Generated schema/v2.json and schema/v3.json");
