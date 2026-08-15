/**
 * Generates JSON Schema (Draft-07) for the v1 motion-project format.
 *
 * Usage: pnpm generate:schema  (runs `tsx scripts/generate-json-schema.ts`)
 *
 * Writes `schema/v1.json` deterministically.
 * Freshness is gated by `test/schema-files.test.ts` on every test run.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeMotionProjectV1JsonSchema } from "./v1-json-schema";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA_DIR = join(ROOT, "schema");
if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

writeFileSync(
  join(SCHEMA_DIR, "v1.json"),
  serializeMotionProjectV1JsonSchema(),
  "utf8",
);

console.log("Generated schema/v1.json");
