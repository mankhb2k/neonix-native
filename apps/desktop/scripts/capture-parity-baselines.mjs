/**
 * Capture parity baseline PNGs at 1280×720 and 1920×1080.
 *
 * Default / --placeholders: solid PNGs under baselines/placeholders/
 * --electron: Electron production-UI capture (see electron-capture-baselines.cjs)
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopRoot, "../..");
const outDir = join(repoRoot, "docs/migration/vite-ui/baselines");
const placeholderDir = join(outDir, "placeholders");
mkdirSync(outDir, { recursive: true });
mkdirSync(placeholderDir, { recursive: true });

const wantElectron = process.argv.includes("--electron");
const wantPlaceholdersOnly = process.argv.includes("--placeholders");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function solidPng(width, height, rgb = [0x18, 0x18, 0x1a]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const surfaces = [
  "home-empty",
  "home-recent",
  "editor-shell",
  "sidebar-layers",
  "timeline-empty",
];
const sizes = [
  { w: 1280, h: 720, tag: "1280" },
  { w: 1920, h: 1080, tag: "1920" },
];

function writePlaceholders() {
  const files = [];
  for (const surface of surfaces) {
    for (const { w, h, tag } of sizes) {
      const name = `${surface}-${tag}.png`;
      const buf = solidPng(w, h);
      writeFileSync(join(placeholderDir, name), buf);
      // Migrate any root solid baseline into placeholders.
      const rootPath = join(outDir, name);
      if (existsSync(rootPath) && !wantElectron) {
        try {
          renameSync(rootPath, join(placeholderDir, name));
        } catch {
          copyFileSync(rootPath, join(placeholderDir, name));
        }
      }
      files.push({
        name,
        width: w,
        height: h,
        sha256: createHash("sha256").update(buf).digest("hex"),
        kind: "fixture-solid-placeholder",
      });
    }
  }
  return files;
}

async function captureWithElectron() {
  const cleanEnv = { ...process.env, VITE_ENABLE_UI_FIXTURES: "1" };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["build:renderer"],
      {
        cwd: desktopRoot,
        stdio: "inherit",
        shell: true,
        env: cleanEnv,
      },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`build:renderer exit ${code}`)),
    );
  });

  const promote = process.env.PROMOTE_BASELINES === "1";
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "electron", "scripts/electron-capture-baselines.cjs"],
      {
        cwd: desktopRoot,
        stdio: "inherit",
        shell: true,
        env: {
          ...cleanEnv,
          ...(promote ? { PROMOTE_BASELINES: "1" } : {}),
        },
      },
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`electron-capture exit ${code}`)),
    );
  });

  // Prefer candidate manifest; fall back to reference after promote.
  const { readFileSync, existsSync } = await import("node:fs");
  const candidateManifest = join(
    desktopRoot,
    "tmp/baseline-candidates/manifest.json",
  );
  const path = existsSync(candidateManifest)
    ? candidateManifest
    : join(outDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  return manifest.files ?? [];
}

const placeholderFiles = writePlaceholders();

if (wantPlaceholdersOnly) {
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        status: "placeholders-only",
        note: "Solid PNGs live under placeholders/. Run with --electron for fixture captures.",
        tolerance: { maxPixelDiffRatio: 0.02 },
        generatedAt: new Date().toISOString(),
        placeholders: placeholderFiles,
        files: [],
      },
      null,
      2,
    )}\n`,
  );
  console.log(`[capture-parity-baselines] placeholders → ${placeholderDir}`);
  process.exit(0);
}

if (wantElectron || !wantPlaceholdersOnly) {
  try {
    const files = await captureWithElectron();
    console.log(
      `[capture-parity-baselines] Wrote ${files.length} Electron fixture captures + placeholders`,
    );
  } catch (err) {
    console.error("[capture-parity-baselines] capture failed:", err);
    writeFileSync(
      join(outDir, "manifest.json"),
      `${JSON.stringify(
        {
          status: "partial-fixtures",
          note: String(err),
          tolerance: { maxPixelDiffRatio: 0.02 },
          generatedAt: new Date().toISOString(),
          placeholders: placeholderFiles,
          files: [],
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  }
}
