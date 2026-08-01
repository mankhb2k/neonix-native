/**
 * Placeholder for Playwright / Electron screenshot capture.
 * Exits 0 with instructions until a headed runner is wired in CI.
 *
 * Target sizes: 1280×720 and 1920×1080 → docs/migration/vite-ui/baselines/
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "docs/migration/vite-ui/baselines");
mkdirSync(outDir, { recursive: true });

const manifest = {
  status: "partial",
  sizes: ["1280x720", "1920x1080"],
  note: "Wire Playwright against Vite desktop; do not claim cutover until PNGs exist.",
  generatedAt: new Date().toISOString(),
};

writeFileSync(
  join(outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  "[capture-parity-baselines] Wrote manifest.json — capture PNGs manually or extend this script with Playwright.",
);
