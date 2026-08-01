/**
 * Pixel-diff baseline candidates vs reference goldens (P20/B1).
 *
 * Candidates: apps/desktop/tmp/baseline-candidates/
 * References: docs/migration/vite-ui/baselines/
 *
 * Prefers .bgra sidecars from Electron capture; falls back to PNG SHA only
 * when bgra missing (still fails cross-surface duplicate + size gates).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const desktopRoot = join(root, "apps/desktop");
const candidateDir = join(desktopRoot, "tmp/baseline-candidates");
const referenceDir = join(root, "docs/migration/vite-ui/baselines");
const referenceManifestPath = join(referenceDir, "manifest.json");
const candidateManifestPath = join(candidateDir, "manifest.json");

function readManifest(path, label) {
  if (!existsSync(path)) {
    console.error(`[compare-baselines] missing ${label} manifest:`, path);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseBgra(buf) {
  const nl = buf.indexOf(0x0a);
  if (nl < 0) throw new Error("invalid bgra header");
  const header = buf.subarray(0, nl).toString("utf8").trim();
  const m = /^(\d+)x(\d+)$/.exec(header);
  if (!m) throw new Error(`invalid bgra header: ${header}`);
  const width = Number(m[1]);
  const height = Number(m[2]);
  const pixels = buf.subarray(nl + 1);
  const expected = width * height * 4;
  if (pixels.length < expected) {
    throw new Error(
      `bgra short: got ${pixels.length} need ${expected} for ${width}x${height}`,
    );
  }
  return { width, height, pixels: pixels.subarray(0, expected) };
}

function diffRatio(a, b) {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (
      a[i] !== b[i] ||
      a[i + 1] !== b[i + 1] ||
      a[i + 2] !== b[i + 2] ||
      a[i + 3] !== b[i + 3]
    ) {
      diff += 1;
    }
  }
  return diff / (a.length / 4);
}

const refManifest = readManifest(referenceManifestPath, "reference");
const candManifest = readManifest(candidateManifestPath, "candidate");
const files = refManifest.files ?? [];
if (!files.length) {
  console.error("[compare-baselines] reference manifest has no files");
  process.exit(1);
}

const maxRatio =
  Number(refManifest.tolerance?.maxPixelDiffRatio ?? 0.02) || 0.02;

if (refManifest.status !== "electron-production-ui") {
  console.warn(
    "[compare-baselines] warning: reference status is",
    refManifest.status,
  );
}

let failed = 0;
const shaBySize = new Map();

for (const entry of files) {
  const candPng = join(candidateDir, entry.name);
  const refPng = join(referenceDir, entry.name);
  const candBgra = join(candidateDir, entry.name.replace(/\.png$/, ".bgra"));
  const refBgra = join(referenceDir, entry.name.replace(/\.png$/, ".bgra"));

  if (!existsSync(candPng)) {
    console.error("[compare-baselines] missing candidate", entry.name);
    failed += 1;
    continue;
  }
  if (!existsSync(refPng)) {
    console.error("[compare-baselines] missing reference", entry.name);
    failed += 1;
    continue;
  }

  const candBuf = readFileSync(candPng);
  if (candBuf.length < 2_000) {
    console.error(
      "[compare-baselines] suspiciously small candidate:",
      entry.name,
      candBuf.length,
    );
    failed += 1;
    continue;
  }

  const placeholderPath = join(referenceDir, "placeholders", entry.name);
  if (existsSync(placeholderPath)) {
    const phSha = createHash("sha256")
      .update(readFileSync(placeholderPath))
      .digest("hex");
    const candSha = createHash("sha256").update(candBuf).digest("hex");
    if (candSha === phSha) {
      console.error(
        "[compare-baselines] candidate matches solid placeholder:",
        entry.name,
      );
      failed += 1;
      continue;
    }
  }

  const sizeKey = entry.name.includes("-1920") ? "1920" : "1280";
  const candSha = createHash("sha256").update(candBuf).digest("hex");
  if (!shaBySize.has(sizeKey)) shaBySize.set(sizeKey, new Map());
  const bucket = shaBySize.get(sizeKey);
  if (bucket.has(candSha)) {
    console.error(
      "[compare-baselines] duplicate candidate SHA across surfaces:",
      bucket.get(candSha),
      "vs",
      entry.name,
    );
    failed += 1;
  } else {
    bucket.set(candSha, entry.name);
  }

  if (existsSync(candBgra) && existsSync(refBgra)) {
    try {
      const a = parseBgra(readFileSync(candBgra));
      const b = parseBgra(readFileSync(refBgra));
      if (a.width !== b.width || a.height !== b.height) {
        console.error(
          "[compare-baselines] size mismatch",
          entry.name,
          `${a.width}x${a.height}`,
          "vs",
          `${b.width}x${b.height}`,
        );
        failed += 1;
        continue;
      }
      const ratio = diffRatio(a.pixels, b.pixels);
      if (ratio > maxRatio) {
        console.error(
          `[compare-baselines] pixel diff ${entry.name}: ${(ratio * 100).toFixed(3)}% > ${(maxRatio * 100).toFixed(2)}%`,
        );
        failed += 1;
      }
    } catch (err) {
      console.error("[compare-baselines] bgra compare failed", entry.name, err);
      failed += 1;
    }
  } else {
    // No bgra sidecars yet (old references): require exact PNG SHA match.
    const refSha = createHash("sha256")
      .update(readFileSync(refPng))
      .digest("hex");
    if (candSha !== refSha) {
      console.error(
        "[compare-baselines] PNG SHA mismatch (no .bgra sidecars — re-capture with PROMOTE_BASELINES=1):",
        entry.name,
      );
      failed += 1;
    }
  }
}

// Candidate manifest should list the same files.
const candNames = new Set((candManifest.files ?? []).map((f) => f.name));
for (const entry of files) {
  if (!candNames.has(entry.name)) {
    console.error(
      "[compare-baselines] candidate manifest missing",
      entry.name,
    );
    failed += 1;
  }
}

if (failed) {
  console.error(`[compare-baselines] FAIL (${failed} issues)`);
  process.exit(1);
}
console.log(
  `[compare-baselines] OK — ${files.length} files (maxPixelDiffRatio=${maxRatio})`,
);
