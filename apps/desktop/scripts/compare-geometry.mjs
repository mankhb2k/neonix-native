/**
 * CSS-0: compare Vite geometry metrics vs web-contract (≤1px on contracted regions).
 *
 * node scripts/compare-geometry.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const metricsDir = join(root, "docs/migration/vite-ui/reference-web/metrics");
const contractPath = join(metricsDir, "web-contract.json");

const MAX_PX = 1;

function fail(msg) {
  console.error("[compare-geometry]", msg);
  process.exitCode = 1;
}

if (!existsSync(contractPath)) {
  fail(`missing web contract: ${contractPath}`);
  process.exit(1);
}

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const viteFiles = existsSync(metricsDir)
  ? readdirSync(metricsDir).filter(
      (f) => f.startsWith("vite-") && f.endsWith(".json") && f !== "vite-index.json",
    )
  : [];

if (!viteFiles.length) {
  fail("no vite-*.json metrics — run capture-geometry-metrics.cjs first");
  process.exit(1);
}

let issues = 0;

for (const file of viteFiles) {
  const m = JSON.parse(readFileSync(join(metricsDir, file), "utf8"));
  const vp = `${m.viewport?.width}x${m.viewport?.height}`;
  const expected = contract.viewports?.[vp];
  if (!expected) {
    console.warn(`[compare-geometry] skip ${file} — no contract for ${vp}`);
    continue;
  }

  // CSS-0 hard gate: titlebar height must already match contract (≤1px).
  // Panel widths/heights are targets for CSS-3 — reported but soft unless STRICT.
  for (const key of ["titlebar", "sidebar", "timeline", "inspector"]) {
    const region = m.regions?.[key];
    const want = expected.regions?.[key];
    if (!want) continue;
    if (!region) {
      if (key === "inspector" && !String(m.surface).includes("editor")) continue;
      if (key === "sidebar" && String(m.surface).startsWith("home")) continue;
      if (key === "timeline" && String(m.surface).startsWith("home")) continue;
      if (key === "titlebar") {
        fail(`${file}: missing region ${key}`);
        issues += 1;
      }
      continue;
    }
    for (const dim of ["width", "height"]) {
      if (want[dim] == null) continue;
      const delta = Math.abs(region[dim] - want[dim]);
      if (delta > MAX_PX) {
        const msg = `${file} ${key}.${dim}: vite=${region[dim]} web=${want[dim]} Δ=${delta} > ${MAX_PX}px`;
        if (key === "titlebar" || process.env.COMPARE_GEOMETRY_STRICT === "1") {
          fail(msg);
          issues += 1;
        } else {
          console.warn(`[compare-geometry] (soft) ${msg}`);
        }
      }
    }
  }
}

if (issues) {
  console.error(`[compare-geometry] FAIL (${issues})`);
  process.exit(1);
}

console.log(
  `[compare-geometry] OK — ${viteFiles.length} vite metrics; titlebar ≤${MAX_PX}px vs web-contract`,
);
