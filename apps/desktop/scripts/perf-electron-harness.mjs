/**
 * Electron interaction microbench (P19/B2) — engineering gate, not 60fps acceptance.
 *
 * - Strips ELECTRON_RUN_AS_NODE
 * - Visible BrowserWindow (avoids hidden-window ~1fps RAF throttle)
 * - Samples rAF after fixture ready + synthetic timeline drag
 * - Fails on timeout / threshold breach (never always-ok)
 *
 * Usage: pnpm test:perf:electron
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(desktopRoot, "tmp");
mkdirSync(outDir, { recursive: true });
const resultPath = join(outDir, "perf-electron-result.json");

/** Engineering thresholds — generous; not 16.7ms acceptance. */
const MAX_MEDIAN_RAF_MS = 50;
const MAX_P95_RAF_MS = 100;
const MAX_DRAG_MS = 5000;
const HARNESS_TIMEOUT_MS = 25_000;

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: desktopRoot,
      stdio: "inherit",
      shell: true,
      env,
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
const MAX_MEDIAN = ${MAX_MEDIAN_RAF_MS};
const MAX_P95 = ${MAX_P95_RAF_MS};
const MAX_DRAG = ${MAX_DRAG_MS};
const HARD_TIMEOUT = ${HARNESS_TIMEOUT_MS};

function fail(payload) {
  writeFileSync(outPath, JSON.stringify({ ok: false, ...payload }, null, 2));
  console.error("[perf-electron-harness]", JSON.stringify(payload));
  app.exit(1);
}

function ok(payload) {
  writeFileSync(outPath, JSON.stringify({ ok: true, ...payload }, null, 2));
  console.log("[perf-electron-harness]", JSON.stringify(payload));
  app.exit(0);
}

const watchdog = setTimeout(() => {
  fail({ reason: "harness-timeout", timeoutMs: HARD_TIMEOUT });
}, HARD_TIMEOUT);

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      show: true,
      frame: false,
      backgroundColor: "#0A0A0B",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    try { win.setPosition(60, 60); } catch (_) {}

    await win.loadURL(pathToFileURL(indexHtml).href + "?fixture=editor-shell");

    const ready = await win.webContents.executeJavaScript(\`
      new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const el = document.querySelector('[data-app-ready="true"][data-ui-fixture="editor-shell"]');
          const timeline = document.querySelector('[data-testid="timeline-viewport"]');
          const text = document.body ? document.body.innerText : "";
          if (text.includes("Starting")) {
            if (Date.now() - start > 12000) resolve(false);
            else requestAnimationFrame(tick);
            return;
          }
          if (el && timeline) resolve(true);
          else if (Date.now() - start > 12000) resolve(false);
          else requestAnimationFrame(tick);
        };
        tick();
      })
    \`);
    if (!ready) {
      clearTimeout(watchdog);
      fail({ reason: "fixture-not-ready" });
      return;
    }

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
        const max = deltas[deltas.length - 1] ?? 0;

        const clip = document.querySelector("[data-clip-id]");
        const zone = document.querySelector("[data-timeline-drop-zone]");
        let dragMs = 0;
        let dragOk = false;
        if (clip && zone) {
          const r = clip.getBoundingClientRect();
          const startX = r.left + Math.min(20, r.width / 2);
          const startY = r.top + r.height / 2;
          const t0 = performance.now();
          clip.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles: true, clientX: startX, clientY: startY, pointerId: 1, buttons: 1,
          }));
          for (let i = 1; i <= 8; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            window.dispatchEvent(new PointerEvent("pointermove", {
              bubbles: true, clientX: startX + i * 12, clientY: startY, pointerId: 1, buttons: 1,
            }));
          }
          window.dispatchEvent(new PointerEvent("pointerup", {
            bubbles: true, clientX: startX + 96, clientY: startY, pointerId: 1, buttons: 0,
          }));
          dragMs = performance.now() - t0;
          dragOk = true;
        }

        return {
          frames: deltas.length,
          median,
          p95,
          max,
          dragMs,
          dragOk,
          note: "visible-window rAF + synthetic drag; not 60fps acceptance",
        };
      })()
    \`);

    clearTimeout(watchdog);
    const failReasons = [];
    if (samples.median > MAX_MEDIAN) failReasons.push("median-raf");
    if (samples.p95 > MAX_P95) failReasons.push("p95-raf");
    if (!samples.dragOk) failReasons.push("drag-missing");
    if (samples.dragMs > MAX_DRAG) failReasons.push("drag-slow");

    if (failReasons.length) {
      fail({ ...samples, reason: failReasons.join(","), thresholds: { MAX_MEDIAN, MAX_P95, MAX_DRAG } });
      return;
    }
    ok(samples);
  } catch (err) {
    clearTimeout(watchdog);
    fail({ reason: "exception", message: String(err && err.stack ? err.stack : err) });
  }
});
`;

writeFileSync(join(outDir, "perf-electron-runner.cjs"), runnerSrc);

const env = cleanEnv({ VITE_ENABLE_UI_FIXTURES: "1" });

await run(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["build:renderer"],
  env,
);

await run(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "electron", "tmp/perf-electron-runner.cjs"],
  env,
);

if (!existsSync(resultPath)) {
  console.error("[perf-electron-harness] missing result file");
  process.exit(1);
}
const result = JSON.parse(readFileSync(resultPath, "utf8"));
if (!result.ok) {
  console.error("[perf-electron-harness] FAIL", result);
  process.exit(1);
}
console.log(
  "[perf-electron-harness] OK — see tmp/perf-electron-result.json (engineering gate, not 60fps)",
);
