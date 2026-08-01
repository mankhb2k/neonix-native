/**
 * Logic-3: wall-clock export bench (frame render + encode).
 * Uses the same CLI env contract as smoke-export-cli.
 *
 *   node scripts/bench-export-split.mjs
 *   node scripts/bench-export-split.mjs --uhd
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const exportCliDir = path.join(desktopRoot, "resources", "export-cli");
const cliEntry = path.join(exportCliDir, "cli-export.cjs");
const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const ffmpegBin = path.join(exportCliDir, ffmpegName);
const wantUhd = process.argv.includes("--uhd");
const scale = wantUhd ? 2 : 0.25;

function exportOutputSize(aspect, s) {
  const base =
    aspect === "1:1"
      ? { width: 1080, height: 1080 }
      : aspect === "9:16"
        ? { width: 1080, height: 1920 }
        : { width: 1920, height: 1080 };
  return {
    width: Math.round(base.width * s),
    height: Math.round(base.height * s),
  };
}

function fail(msg) {
  console.error(`[bench-export-split] FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(cliEntry)) {
  fail(`missing ${cliEntry} — run pnpm build:export-cli first`);
}

const require = createRequire(path.join(desktopRoot, "package.json"));
let electronPath;
try {
  electronPath = require("electron");
} catch {
  fail("electron not resolvable");
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-bench-export-"));
const projectPath = path.join(outDir, "bench.project.json");
const mp4Path = path.join(outDir, "out.mp4");
const exportOutDir = path.join(outDir, "frames");
fs.mkdirSync(exportOutDir, { recursive: true });

const project = {
  format: "motion-project",
  formatVersion: 2,
  metadata: {
    id: "bench.export",
    name: "Bench",
    aspectRatio: "16:9",
    fps: 24,
    locale: "vi-VN",
    brand: { name: "Bench", primaryColor: "#111", fontFamily: "Arial" },
  },
  dependencies: { components: [] },
  assets: [],
  variables: [],
  timeline: { sceneOrder: ["scene.a"], audioTracks: [] },
  scenes: [
    {
      id: "scene.a",
      duration: wantUhd ? 0.5 : 0.25,
      nodes: [
        {
          id: "n1",
          type: "text",
          parentId: null,
          transform: {
            x: 100,
            y: 100,
            width: 400,
            height: 80,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0,
            anchorY: 0,
            opacity: 1,
            visible: true,
            flipX: false,
            flipY: false,
          },
          payload: { text: "Bench", fontSize: 48, align: "left" },
          style: { fill: "#ffffff" },
        },
      ],
      clips: [],
    },
  ],
  bindings: [],
  extensions: { constraints: [], events: [] },
};

fs.writeFileSync(projectPath, JSON.stringify(project));

const expected = exportOutputSize("16:9", scale);
const t0 = Date.now();
const result = spawnSync(electronPath, [cliEntry, projectPath], {
  encoding: "utf8",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    FFMPEG_BIN: ffmpegBin,
    NODE_PATH: path.join(exportCliDir, "node_modules"),
    MOTIONVIDEO_EXPORT_OUT_DIR: exportOutDir,
    MOTIONVIDEO_EXPORT_ASSET_BASE: outDir,
    MOTIONVIDEO_EXPORT_MP4_PATH: mp4Path,
    MOTIONVIDEO_EXPORT_FPS: wantUhd ? "24" : "8",
    MOTIONVIDEO_EXPORT_SCALE: String(scale),
  },
  cwd: exportCliDir,
  timeout: wantUhd ? 600_000 : 120_000,
});
const wallMs = Date.now() - t0;

let parsed = null;
for (const line of (result.stdout || "").split(/\r?\n/).reverse()) {
  const t = line.trim();
  if (!t.startsWith("{")) continue;
  try {
    parsed = JSON.parse(t);
    break;
  } catch {
    /* continue */
  }
}

if (!parsed?.ok || !fs.existsSync(parsed.mp4Path ?? mp4Path)) {
  fail(
    `cli exit ${result.status}: ${JSON.stringify(parsed)} ${(result.stderr || "").slice(-800)}`,
  );
}

const report = {
  ok: true,
  mode: wantUhd ? "uhd-soak" : "preview-bench",
  scale,
  expectedSize: expected,
  wallMs,
  phases: {
    wallMs,
    note: "CLI currently reports single ok payload; wall clock covers frame+encode",
  },
  outputBytes: fs.statSync(parsed.mp4Path ?? mp4Path).size,
};
const outReport = path.join(desktopRoot, "tmp", "bench-export-split.json");
fs.mkdirSync(path.dirname(outReport), { recursive: true });
fs.writeFileSync(outReport, `${JSON.stringify(report, null, 2)}\n`);
console.info("[bench-export-split]", JSON.stringify(report));
