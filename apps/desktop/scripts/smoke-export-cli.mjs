/**
 * Packaged-runtime smoke for export-cli natives (Wave 1 gate).
 * Requires prior `pnpm build:export-cli`.
 *
 * Verifies:
 * - canvas native binding loads under ELECTRON_RUN_AS_NODE
 * - ffmpeg.exe sits beside CLI and is executable
 * - cli-export.cjs encodes a 1-frame-ish minimal project without MODULE_NOT_FOUND
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

function fail(message) {
  console.error(`[smoke-export-cli] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.info(`[smoke-export-cli] ok: ${message}`);
}

if (!fs.existsSync(cliEntry)) {
  fail(`missing ${cliEntry} — run build:export-cli first`);
}
if (!fs.existsSync(ffmpegBin)) {
  fail(`ffmpeg-exists: false (${ffmpegBin})`);
}
ok(`ffmpeg-exists: true (${ffmpegBin})`);

const requireFromCli = createRequire(path.join(exportCliDir, "package.json"));
try {
  requireFromCli("@napi-rs/canvas");
  ok("canvas require (node) succeeded");
} catch (error) {
  fail(
    `canvas-fail (node): ${error instanceof Error ? error.message : String(error)}`,
  );
}

const electronBin = path.join(
  desktopRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);
if (!fs.existsSync(electronBin)) {
  // monorepo hoist
  const alt = path.join(
    desktopRoot,
    "..",
    "..",
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron.cmd" : "electron",
  );
  if (!fs.existsSync(alt)) {
    fail(`electron binary not found at ${electronBin}`);
  }
}

const resolveElectron = () => {
  const candidates = [
    path.join(desktopRoot, "node_modules", "electron", "cli.js"),
    path.join(desktopRoot, "..", "..", "node_modules", ".pnpm"),
  ];
  // Prefer electron executable via require('electron')
  try {
    const req = createRequire(path.join(desktopRoot, "package.json"));
    const electronPath = req("electron");
    if (typeof electronPath === "string" && fs.existsSync(electronPath)) {
      return electronPath;
    }
  } catch {
    /* fall through */
  }
  void candidates;
  const which = spawnSync(
    process.platform === "win32" ? "where" : "which",
    ["electron"],
    { encoding: "utf8", shell: true },
  );
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }
  // pnpm electron path
  const req = createRequire(path.join(desktopRoot, "package.json"));
  return req("electron");
};

const electronExec = resolveElectron();
if (typeof electronExec !== "string" || !electronExec) {
  fail("could not resolve electron executable path");
}
ok(`electron=${electronExec}`);

const probeScript = `
const fs = require("fs");
const path = require("path");
const canvas = require("@napi-rs/canvas");
const ffmpeg = process.env.FFMPEG_BIN;
const out = {
  canvasOk: Boolean(canvas && canvas.createCanvas),
  ffmpegExists: Boolean(ffmpeg && fs.existsSync(ffmpeg)),
  ffmpeg,
};
process.stdout.write(JSON.stringify(out) + "\\n");
`;

const probeFile = path.join(exportCliDir, `_smoke_probe_${process.pid}.cjs`);
fs.writeFileSync(probeFile, probeScript, "utf8");

const probe = spawnSync(electronExec, [probeFile], {
  cwd: exportCliDir,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    FFMPEG_BIN: ffmpegBin,
    NODE_PATH: path.join(exportCliDir, "node_modules"),
  },
  encoding: "utf8",
  shell: false,
});

try {
  fs.unlinkSync(probeFile);
} catch {
  /* ignore */
}

if (probe.status !== 0) {
  fail(
    `canvas-fail (electron-as-node): status=${probe.status}\nstdout=${probe.stdout}\nstderr=${probe.stderr}`,
  );
}

let probeJson;
try {
  const line = probe.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1);
  probeJson = JSON.parse(line ?? "{}");
} catch {
  fail(`probe stdout not JSON: ${probe.stdout}`);
}

if (!probeJson.canvasOk) {
  fail(
    `canvas-fail: Cannot find native binding (probe=${JSON.stringify(probeJson)})`,
  );
}
if (!probeJson.ffmpegExists) {
  fail(`ffmpeg-exists: false (probe=${JSON.stringify(probeJson)})`);
}
ok("canvas + ffmpeg under ELECTRON_RUN_AS_NODE");

const minimalProject = {
  format: "motion-project",
  formatVersion: 3,
  metadata: {
    id: "smoke_export_cli",
    name: "Smoke Export",
    locale: "vi-VN",
  },
  composition: {
    width: 1920,
    height: 1080,
    fps: 24,
    background: "#111111",
    colorSpace: "srgb",
    audioSampleRate: 48000,
  },
  capabilities: {},
  dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
  assets: [],
  variables: [],
  tokens: {},
  components: [],
  timeline: {
    visualTracks: [
      {
        id: "main-track",
        role: "main",
        order: 0,
        clips: [
          {
            id: "clip_smoke",
            source: { kind: "scene", sceneId: "scene_smoke" },
            start: 0,
            duration: 0.2,
          },
        ],
      },
    ],
    audioTracks: [],
    captionTracks: [],
  },
  scenes: [
    {
      id: "scene_smoke",
      duration: 0.2,
      nodes: [
        {
          id: "node_1",
          type: "text",
          parentId: null,
          name: "Hi",
          transform: {
            x: 100,
            y: 100,
            width: 200,
            height: 40,
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
          payload: {
            content: { kind: "plain", text: "Smoke" },
            fontSize: 24,
            color: "#ffffff",
            alignment: "left",
          },
        },
      ],
      clips: [],
    },
  ],
  bindings: [],
};

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-export-smoke-"));
const projectPath = path.join(workDir, "project.json");
const outDir = path.join(workDir, "out");
const mp4Path = path.join(workDir, "out.mp4");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(projectPath, JSON.stringify(minimalProject), "utf8");

const exportRun = spawnSync(electronExec, [cliEntry, projectPath], {
  cwd: exportCliDir,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    FFMPEG_BIN: ffmpegBin,
    NODE_PATH: path.join(exportCliDir, "node_modules"),
    MOTIONVIDEO_EXPORT_OUT_DIR: outDir,
    MOTIONVIDEO_EXPORT_ASSET_BASE: workDir,
    MOTIONVIDEO_EXPORT_MP4_PATH: mp4Path,
    MOTIONVIDEO_EXPORT_FPS: "8",
    MOTIONVIDEO_EXPORT_SCALE: "0.25",
  },
  encoding: "utf8",
  shell: false,
  timeout: 120_000,
});

const combined = `${exportRun.stdout}\n${exportRun.stderr}`;
if (/Cannot find native binding|MODULE_NOT_FOUND/i.test(combined)) {
  fail(`export native error:\n${combined.slice(-2000)}`);
}

let result = null;
for (const line of exportRun.stdout.split(/\r?\n/).reverse()) {
  const t = line.trim();
  if (!t.startsWith("{")) continue;
  try {
    result = JSON.parse(t);
    break;
  } catch {
    /* continue */
  }
}

if (!result || result.ok !== true) {
  fail(
    `cli-export did not succeed: status=${exportRun.status}\n` +
      `result=${JSON.stringify(result)}\n` +
      `tail=${combined.slice(-2000)}`,
  );
}

if (!fs.existsSync(result.mp4Path ?? mp4Path)) {
  fail(`mp4 missing after ok result: ${result.mp4Path ?? mp4Path}`);
}

ok(`cli-export ok mp4=${result.mp4Path ?? mp4Path}`);
console.info("[smoke-export-cli] PASS");
