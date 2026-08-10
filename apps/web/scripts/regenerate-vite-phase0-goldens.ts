/**
 * Regenerate Vite Phase 0 goldens (docs/migration/vite-phase-0).
 * Run: tsx scripts/regenerate-vite-phase0-goldens.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildPhase0Goldens,
  buildPhase0LargeFixture,
  buildPhase0MediumFixture,
  buildPhase0SmallFixture,
} from "../lib/editor/__fixtures__/vite-phase0";

const PHASE0_DIR = path.resolve(
  __dirname,
  "../../../docs/migration/vite-phase-0",
);
const FIXTURES_DIR = path.join(PHASE0_DIR, "fixtures");
const GOLDENS_DIR = path.join(PHASE0_DIR, "goldens");

fs.mkdirSync(FIXTURES_DIR, { recursive: true });
fs.mkdirSync(GOLDENS_DIR, { recursive: true });

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

writeJson(
  path.join(FIXTURES_DIR, "small.project.json"),
  buildPhase0SmallFixture(),
);
writeJson(
  path.join(FIXTURES_DIR, "medium.project.json"),
  buildPhase0MediumFixture(),
);
writeJson(
  path.join(FIXTURES_DIR, "large.project.json"),
  buildPhase0LargeFixture(),
);

for (const [name, snapshot] of Object.entries(buildPhase0Goldens())) {
  writeJson(path.join(GOLDENS_DIR, `${name}.after.json`), snapshot);
}

console.log("Vite Phase 0 goldens regenerated.");
