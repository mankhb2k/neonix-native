/**
 * Compare baseline PNGs against manifest (P20).
 * Fails if a listed file is missing, too small (solid placeholder-like),
 * or sha256 mismatches when EXPECT_SHA=1.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "docs/migration/vite-ui/baselines");
const manifestPath = join(outDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("[compare-baselines] missing manifest.json");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const files = manifest.files ?? [];
if (!files.length) {
  console.error("[compare-baselines] manifest has no files (status=", manifest.status, ")");
  process.exit(1);
}

if (manifest.status !== "electron-production-ui") {
  console.warn(
    "[compare-baselines] warning: status is",
    manifest.status,
    "(expected electron-production-ui)",
  );
}

let failed = 0;
for (const entry of files) {
  const path = join(outDir, entry.name);
  if (!existsSync(path)) {
    console.error("[compare-baselines] missing", entry.name);
    failed += 1;
    continue;
  }
  const buf = readFileSync(path);
  // Reject tiny/empty files; solid placeholders are typically ~4.3KB @1280.
  if (buf.length < 2_000) {
    console.error(
      "[compare-baselines] suspiciously small PNG:",
      entry.name,
      buf.length,
    );
    failed += 1;
    continue;
  }
  const sha = createHash("sha256").update(buf).digest("hex");
  const placeholderPath = join(outDir, "placeholders", entry.name);
  if (existsSync(placeholderPath)) {
    const ph = readFileSync(placeholderPath);
    const phSha = createHash("sha256").update(ph).digest("hex");
    if (sha === phSha) {
      console.error(
        "[compare-baselines] matches solid placeholder:",
        entry.name,
      );
      failed += 1;
      continue;
    }
  }
  if (process.env.EXPECT_SHA === "1" && entry.sha256 && sha !== entry.sha256) {
    console.error("[compare-baselines] sha mismatch", entry.name);
    failed += 1;
  }
}

if (failed) {
  console.error(`[compare-baselines] FAIL (${failed} issues)`);
  process.exit(1);
}
console.log(`[compare-baselines] OK — ${files.length} files`);
