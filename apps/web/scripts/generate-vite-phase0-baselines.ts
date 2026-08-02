/**
 * Write Vite Phase 0 fixtures + goldens to docs/migration/vite-phase-0/.
 *
 *   pnpm --filter @motionvideo/web generate:vite-phase0
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildPhase0Goldens,
  buildPhase0LargeFixture,
  buildPhase0MediumFixture,
  buildPhase0SmallFixture,
} from "../lib/editor/__fixtures__/vite-phase0";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(REPO_ROOT, "docs/migration/vite-phase-0");
const FIXTURES_DIR = path.join(OUT_DIR, "fixtures");
const GOLDENS_DIR = path.join(OUT_DIR, "goldens");

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main(): void {
  writeJson(path.join(FIXTURES_DIR, "small.project.json"), buildPhase0SmallFixture());
  writeJson(path.join(FIXTURES_DIR, "medium.project.json"), buildPhase0MediumFixture());
  writeJson(path.join(FIXTURES_DIR, "large.project.json"), buildPhase0LargeFixture());

  const goldens = buildPhase0Goldens();
  for (const [name, snapshot] of Object.entries(goldens)) {
    writeJson(path.join(GOLDENS_DIR, `${name}.after.json`), snapshot);
  }

  console.log(`Wrote fixtures → ${FIXTURES_DIR}`);
  console.log(`Wrote ${Object.keys(goldens).length} goldens → ${GOLDENS_DIR}`);
}

main();
