/**
 * Electron interaction microbench (CSS-0) — engineering gate, not 60fps acceptance.
 *
 * Single input path: in-page PointerEvent on timeline clip strip (reactPointerHandler).
 * Fixture probe is read-only (historyDepth / clip startTime).
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(desktopRoot, "tmp");
mkdirSync(outDir, { recursive: true });
const resultPath = join(outDir, "perf-electron-result.json");

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
const INPUT_PATH = "reactPointerHandler";

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      enableLargerThanScreen: true,
      backgroundColor: "#0A0A0B",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    try {
      win.setPosition(60, 60);
      win.setContentSize(1280, 720);
    } catch (_) {}

    await win.loadURL(pathToFileURL(indexHtml).href + "?fixture=editor-shell");
    try { win.setContentSize(1280, 720); } catch (_) {}

    const ready = await win.webContents.executeJavaScript(\`
      new Promise((resolve) => {
        const inViewport = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return (
            r.height > 0 &&
            r.width > 0 &&
            r.top >= 0 &&
            r.bottom <= window.innerHeight + 1
          );
        };
        const start = Date.now();
        const tick = () => {
          const el = document.querySelector('[data-app-ready="true"][data-ui-fixture="editor-shell"]');
          const timeline = document.querySelector('[data-testid="timeline-viewport"]');
          const clip = document.querySelector('[data-testid="timeline-clip-strip"][data-clip-id]');
          const text = document.body ? document.body.innerText : "";
          if (text.includes("Starting")) {
            if (Date.now() - start > 12000) resolve(false);
            else requestAnimationFrame(tick);
            return;
          }
          if (el && timeline && inViewport(timeline) && clip && inViewport(clip)) resolve(true);
          else if (Date.now() - start > 12000) resolve(false);
          else requestAnimationFrame(tick);
        };
        tick();
      })
    \`);
    if (!ready) {
      clearTimeout(watchdog);
      fail({ reason: "fixture-not-ready-or-timeline-out-of-view" });
      return;
    }

    await win.webContents.executeJavaScript(\`
      (() => {
        window.__MV_PERF_CONSOLE_ERRORS__ = [];
        const orig = console.error.bind(console);
        window.__MV_PERF_ORIG_CONSOLE_ERROR__ = orig;
        console.error = (...args) => {
          window.__MV_PERF_CONSOLE_ERRORS__.push(args.map(String).join(" "));
          orig(...args);
        };
      })()
    \`);

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
        const clip = document.querySelector('[data-testid="timeline-clip-strip"][data-clip-id]');
        const r0 = clip ? clip.getBoundingClientRect() : null;
        const inView = !!(
          r0 &&
          r0.height > 0 &&
          r0.top >= 0 &&
          r0.bottom <= window.innerHeight + 1
        );
        const probe = window.__MV_FIXTURE_PROBE__;
        const beforeClip = probe && typeof probe.getPrimaryClip === "function"
          ? probe.getPrimaryClip()
          : null;
        const historyDepthBefore = probe && typeof probe.historyDepth === "function"
          ? probe.historyDepth()
          : null;
        const lastHistoryIdBefore = probe && typeof probe.lastHistoryEntryId === "function"
          ? probe.lastHistoryEntryId()
          : null;
        return {
          frames: deltas.length,
          median: deltas[Math.floor(deltas.length * 0.5)] ?? 0,
          p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0,
          max: deltas[deltas.length - 1] ?? 0,
          inView,
          beforeClip,
          historyDepthBefore,
          lastHistoryIdBefore,
          clip: r0
            ? {
                x: Math.round(r0.left + Math.min(20, r0.width / 2)),
                y: Math.round(r0.top + r0.height / 2),
                startTime: clip.getAttribute("data-start-time") ?? "",
                left: r0.left,
              }
            : null,
        };
      })()
    \`);

    if (!samples.clip || !samples.inView) {
      clearTimeout(watchdog);
      fail({
        ...samples,
        inputPath: INPUT_PATH,
        reason: "clip-out-of-view",
        dragOk: false,
        pointerDragOk: false,
        commandMutationOk: false,
        historyOk: false,
      });
      return;
    }

    const before = samples.clip;
    const t0 = Date.now();

    try {
      win.focus();
      win.webContents.focus();
    } catch (_) {}

    // CSS-0: exactly one input path — reactPointerHandler (not sendInputEvent).
    const gesture = await win.webContents.executeJavaScript(\`
      (() => {
        const el = document.querySelector('[data-testid="timeline-clip-strip"][data-clip-id]');
        if (!el) return { ok: false, reason: "no-clip-el" };
        const r = el.getBoundingClientRect();
        const x0 = r.left + Math.min(20, Math.max(4, r.width / 2));
        const y0 = r.top + r.height / 2;
        const opts = (x, y, buttons) => ({
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
          button: 0,
          buttons,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        });
        el.dispatchEvent(new PointerEvent("pointerdown", opts(x0, y0, 1)));
        for (let i = 1; i <= 12; i += 1) {
          window.dispatchEvent(
            new PointerEvent("pointermove", opts(x0 + i * 16, y0, 1)),
          );
        }
        window.dispatchEvent(
          new PointerEvent("pointerup", opts(x0 + 192, y0, 0)),
        );
        return { ok: true, x0, y0 };
      })()
    \`);
    await sleep(200);

    const after = await win.webContents.executeJavaScript(\`
      (() => {
        const clip = document.querySelector('[data-testid="timeline-clip-strip"][data-clip-id]');
        const r = clip ? clip.getBoundingClientRect() : null;
        const probe = window.__MV_FIXTURE_PROBE__;
        const afterClip = probe && typeof probe.getPrimaryClip === "function"
          ? probe.getPrimaryClip()
          : null;
        const historyDepthAfter = probe && typeof probe.historyDepth === "function"
          ? probe.historyDepth()
          : null;
        const lastHistoryIdAfter = probe && typeof probe.lastHistoryEntryId === "function"
          ? probe.lastHistoryEntryId()
          : null;
        const consoleErrors = Array.isArray(window.__MV_PERF_CONSOLE_ERRORS__)
          ? window.__MV_PERF_CONSOLE_ERRORS__.slice()
          : [];
        if (typeof window.__MV_PERF_ORIG_CONSOLE_ERROR__ === "function") {
          console.error = window.__MV_PERF_ORIG_CONSOLE_ERROR__;
        }
        return {
          startTime: clip ? (clip.getAttribute("data-start-time") ?? "") : "",
          left: r ? r.left : null,
          afterClip,
          historyDepthAfter,
          lastHistoryIdAfter,
          consoleErrors,
        };
      })()
    \`);

    const dragMs = Date.now() - t0;
    const startChanged =
      !!after &&
      after.afterClip &&
      samples.beforeClip &&
      after.afterClip.startTime !== samples.beforeClip.startTime;
    const leftChanged =
      !!after &&
      after.left != null &&
      Math.abs(after.left - before.left) > 2;
    const commandMutationOk = !!(startChanged || leftChanged);
    const historyDelta =
      after &&
      samples.historyDepthBefore != null &&
      after.historyDepthAfter != null
        ? after.historyDepthAfter - samples.historyDepthBefore
        : null;
    const historyOk = historyDelta === 1;
    const pointerDragOk =
      !!(gesture && gesture.ok) && commandMutationOk && historyOk;
    const dragOk =
      samples.inView && pointerDragOk && commandMutationOk && historyOk;

    clearTimeout(watchdog);
    const payload = {
      frames: samples.frames,
      median: samples.median,
      p95: samples.p95,
      max: samples.max,
      dragMs,
      dragOk,
      pointerDragOk,
      commandMutationOk,
      historyOk,
      historyDelta,
      inputPath: INPUT_PATH,
      inView: samples.inView,
      before,
      after,
      beforeClip: samples.beforeClip,
      historyDepthBefore: samples.historyDepthBefore,
      lastHistoryIdBefore: samples.lastHistoryIdBefore,
      gesture,
      consoleErrors: after.consoleErrors ?? [],
      note: "CSS-0: single reactPointerHandler gesture; historyDepth +1; not 60fps",
    };
    const failReasons = [];
    if (samples.median > MAX_MEDIAN) failReasons.push("median-raf");
    if (samples.p95 > MAX_P95) failReasons.push("p95-raf");
    if (!samples.inView) failReasons.push("clip-out-of-view");
    if (!(gesture && gesture.ok)) failReasons.push("gesture-dispatch-failed");
    if (!commandMutationOk) failReasons.push("no-mutation");
    if (!historyOk) failReasons.push("history-delta-not-1");
    if (!pointerDragOk) failReasons.push("pointer-drag-failed");
    if (!dragOk) failReasons.push("drag-failed");
    if (dragMs > MAX_DRAG) failReasons.push("drag-slow");
    if (Array.isArray(payload.consoleErrors) && payload.consoleErrors.length) {
      failReasons.push("console-error");
    }
    if (failReasons.length) {
      fail({ ...payload, reason: failReasons.join(","), thresholds: { MAX_MEDIAN, MAX_P95, MAX_DRAG } });
      return;
    }
    ok(payload);
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
