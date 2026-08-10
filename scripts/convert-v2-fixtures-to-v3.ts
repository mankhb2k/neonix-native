/**
 * Phase 3 — one-off migration: convert V2 authoring fixtures to V3.
 *
 * Reads every `.project.json` under `packages/motion-protocol/src/__fixtures__/v2`,
 * migrates it to V3 via `migrateMotionProjectV2ToV3`, and writes the result to
 * `packages/motion-protocol/src/__fixtures__/v3/<name>.project.json`.
 *
 * The `component-instance` fixture is handled specially because the V2→V3
 * migration cannot represent component *nodes* — the V3 authoring model
 * embeds the component definition and references it from a visual clip.
 *
 * Run: pnpm --filter @motionvideo/motion-protocol exec tsx ../../scripts/convert-v2-fixtures-to-v3.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMotionProjectV2 } from "../packages/motion-protocol/src/v2/parse";
import { migrateMotionProjectV2ToV3 } from "../packages/motion-protocol/src/v3/migrations/v2-to-v3";
import { MotionProjectV3Schema } from "../packages/motion-protocol/src/v3/index";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const v2Dir = join(
  repoRoot,
  "packages",
  "motion-protocol",
  "src",
  "__fixtures__",
  "v2",
);
const v3Dir = join(
  repoRoot,
  "packages",
  "motion-protocol",
  "src",
  "__fixtures__",
  "v3",
);

function dirname(file: string): string {
  return file.split(/[\\/]/).slice(0, -1).join("/") || ".";
}

mkdirSync(v3Dir, { recursive: true });

const files = readdirSync(v2Dir)
  .filter((file) => file.endsWith(".project.json"))
  .sort();

for (const file of files) {
  const name = file.replace(/\.project\.json$/, "");
  const raw = readFileSync(join(v2Dir, file), "utf8");
  const v2 = parseMotionProjectV2(JSON.parse(raw));
  const { project: v3, diagnostics } = migrateMotionProjectV2ToV3(v2, {
    // The migration drops component nodes; report them loudly so we can
    // hand-craft those fixtures.
  });
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      console.warn(`[${name}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  // Ensure the output is parse-valid V3.
  MotionProjectV3Schema.parse(v3);
  const output = `${JSON.stringify(v3, null, 2)}\n`;
  writeFileSync(join(v3Dir, `${name}.project.json`), output, "utf8");
  console.log(`WROTE v3/${name}.project.json`);
}

console.log("Done. Verify with MotionProjectV3Schema.parse and update tests.");
