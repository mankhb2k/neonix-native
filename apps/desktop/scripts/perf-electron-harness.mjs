/**
 * Electron paint microbench (P19) — not a 60fps acceptance gate.
 * Builds renderer, loads fixture surface, samples rAF durations.
 *
 * Usage: node scripts/perf-electron-harness.mjs
 * Or: pnpm test:perf:electron
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(desktopRoot, "tmp");
mkdirSync(outDir, { recursive: true });

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: desktopRoot,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)),
    );
  });
}

const runnerSrc = `
const { app, BrowserWindow } = require("electron");
const { pathToFileURL } = require("node:url");
const { join } = require("node:path");
const { writeFileSync } = require("node:fs");

const indexHtml = join(__dirname, "../dist-renderer/index.html");
const outPath = join(__dirname, "../tmp/perf-electron-result.json");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    frame: false,
    backgroundColor: "#0A0A0B",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(pathToFileURL(indexHtml).href + "?fixture=editor-shell");
  await new Promise((r) => setTimeout(r, 600));
  const samples = await win.webContents.executeJavaScript(\`
    (async () => {
      const times = [];
      await new Promise((resolve) => {
        let n = 0;
        const tick = (t) => {
          times.push(t);
          n += 1;
          if (n >= 61) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const deltas = [];
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
      deltas.sort((a, b) => a - b);
      const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? 0;
      const median = deltas[Math.floor(deltas.length * 0.5)] ?? 0;
      return { frames: deltas.length, median, p95, max: deltas[deltas.length - 1] ?? 0 };
    })()
  \`);
  writeFileSync(outPath, JSON.stringify({ ok: true, ...samples, note: "rAF deltas ms; not paintFrame acceptance" }, null, 2));
  console.log("[perf-electron-harness]", JSON.stringify(samples));
  app.exit(0);
});
`;

writeFileSync(join(desktopRoot, "tmp/perf-electron-runner.cjs"), runnerSrc);

await new Promise((resolve, reject) => {
  const child = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["build:renderer"],
    {
      cwd: desktopRoot,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, VITE_ENABLE_UI_FIXTURES: "1" },
    },
  );
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`build:renderer exit ${code}`)),
  );
});
await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
  "exec",
  "electron",
  "tmp/perf-electron-runner.cjs",
]);

console.log(
  "[perf-electron-harness] done — see tmp/perf-electron-result.json (regression signal only)",
);
