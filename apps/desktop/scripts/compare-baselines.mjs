/**
 * Pixel-diff baseline candidates vs reference goldens (UI-0).
 *
 * Candidates: apps/desktop/tmp/baseline-candidates/
 * References: docs/migration/vite-ui/baselines/
 *
 * Prefers sharp (raw RGBA). Falls back to Electron nativeImage helper when
 * sharp cannot be resolved (e.g. incomplete node_modules link on Windows).
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const desktopRoot = join(root, "apps/desktop");
const candidateDir = join(desktopRoot, "tmp/baseline-candidates");
const referenceDir = join(root, "docs/migration/vite-ui/baselines");
const referenceManifestPath = join(referenceDir, "manifest.json");
const candidateManifestPath = join(candidateDir, "manifest.json");
const tmpDir = join(desktopRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });

const require = createRequire(import.meta.url);

function tryLoadSharp() {
  const candidates = [
    join(desktopRoot, "node_modules/sharp"),
    join(desktopRoot, ".deps-sharp/node_modules/sharp"),
    join(root, "node_modules/sharp"),
    join(root, "node_modules/.pnpm/sharp@0.34.5/node_modules/sharp"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(join(p, "package.json"))) return require(p);
    } catch {
      /* try next */
    }
  }
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

function readManifest(path, label) {
  if (!existsSync(path)) {
    console.error(`[compare-baselines] missing ${label} manifest:`, path);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function runElectron(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "electron", script],
      {
        cwd: desktopRoot,
        stdio: "inherit",
        shell: true,
        env: cleanEnv(env),
      },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`electron exit ${code}`)),
    );
  });
}

function pixelDiffRatio(a, b) {
  if (a.length !== b.length) return 1;
  let diff = 0;
  const pixels = a.length / 4;
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
  return diff / pixels;
}

async function diffWithSharp(sharp, pairs, maxRatio) {
  let failed = 0;
  for (const pair of pairs) {
    try {
      const cand = await sharp(pair.cand)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const ref = await sharp(pair.ref)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (
        cand.info.width !== ref.info.width ||
        cand.info.height !== ref.info.height
      ) {
        console.error(
          "[compare-baselines] pixel fail",
          pair.name,
          "size-mismatch",
        );
        failed += 1;
        continue;
      }
      if (
        pair.width &&
        pair.height &&
        (cand.info.width !== pair.width || cand.info.height !== pair.height)
      ) {
        console.error(
          "[compare-baselines] pixel fail",
          pair.name,
          "manifest-size",
        );
        failed += 1;
        continue;
      }
      const ratio = pixelDiffRatio(cand.data, ref.data);
      if (ratio > maxRatio) {
        console.error(
          "[compare-baselines] pixel fail",
          pair.name,
          `ratio=${(ratio * 100).toFixed(3)}% > ${(maxRatio * 100).toFixed(2)}%`,
        );
        failed += 1;
      }
    } catch (err) {
      console.error("[compare-baselines] pixel fail", pair.name, err);
      failed += 1;
    }
  }
  return failed;
}

async function diffWithElectron(pairs, maxRatio) {
  const jobPath = join(tmpDir, "compare-job.json");
  const resultPath = join(tmpDir, "compare-result.json");
  writeFileSync(jobPath, `${JSON.stringify({ maxRatio, pairs }, null, 2)}\n`);
  await runElectron("scripts/compare-baselines-pixel.cjs", {
    COMPARE_JOB_JSON: jobPath,
    COMPARE_RESULT_JSON: resultPath,
  });
  const { results } = JSON.parse(readFileSync(resultPath, "utf8"));
  let failed = 0;
  for (const row of results ?? []) {
    if (!row.ok) {
      console.error(
        "[compare-baselines] pixel fail",
        row.name,
        row.reason ??
          `ratio=${((row.ratio ?? 1) * 100).toFixed(3)}% > ${(maxRatio * 100).toFixed(2)}%`,
      );
      failed += 1;
    }
  }
  return failed;
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
const pairs = [];

for (const entry of files) {
  const candPng = join(candidateDir, entry.name);
  const refPng = join(referenceDir, entry.name);

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

  pairs.push({
    name: entry.name,
    cand: candPng,
    ref: refPng,
    width: entry.width,
    height: entry.height,
  });
}

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

if (pairs.length) {
  const sharp = tryLoadSharp();
  if (sharp) {
    console.log("[compare-baselines] using sharp PNG RGBA pixel-diff");
    failed += await diffWithSharp(sharp, pairs, maxRatio);
  } else {
    console.warn(
      "[compare-baselines] sharp unavailable — falling back to Electron nativeImage pixel-diff",
    );
    try {
      failed += await diffWithElectron(pairs, maxRatio);
    } catch (err) {
      console.error("[compare-baselines] electron pixel helper failed", err);
      failed += 1;
    }
  }
}

if (failed) {
  console.error(`[compare-baselines] FAIL (${failed} issues)`);
  process.exit(1);
}
console.log(
  `[compare-baselines] OK — ${files.length} files (maxPixelDiffRatio=${maxRatio})`,
);
