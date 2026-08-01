/**
 * Logic-5 — lifecycle E2E (Vite prod + preload; not full NSIS packaged).
 * 1) vitest: real project-file-service save/reopen (motion-editor-project)
 * 2) export-cli encode smoke
 * 3) Electron dirty-close: Cancel / Save ok / Save fail → confirmClose asserts
 *
 *   pnpm --filter @motionvideo/desktop test:e2e:lifecycle
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runPnpm, runVitest } from "./lib/spawn-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const require = createRequire(path.join(desktopRoot, "package.json"));
const outReport = path.join(desktopRoot, "tmp", "e2e-lifecycle-result.json");

function fail(reason, extra = {}) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: false, reason, ...extra }, null, 2)}\n`,
  );
  console.error("[e2e-lifecycle] FAIL:", reason, extra);
  process.exit(1);
}

function ok(payload) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`,
  );
  console.info("[e2e-lifecycle] OK", JSON.stringify(payload));
}

function ensureBuild() {
  const mainJs = path.join(desktopRoot, "dist", "main", "index.js");
  const preloadJs = path.join(desktopRoot, "dist", "preload", "index.js");
  const cli = path.join(desktopRoot, "resources", "export-cli", "cli-export.cjs");
  const steps = [];
  if (!fs.existsSync(mainJs) || !fs.existsSync(preloadJs)) {
    steps.push(["build:main"]);
    steps.push(["build:preload"]);
  }
  // Always rebuild renderer so fixture close-save wiring matches source.
  steps.push(["build:renderer"]);
  if (!fs.existsSync(cli)) {
    steps.push(["build:export-cli"]);
  }
  for (const args of steps) {
    const r = runPnpm(args, {
      cwd: desktopRoot,
      env: {
        ...process.env,
        ...(args[0] === "build:renderer"
          ? { VITE_ENABLE_UI_FIXTURES: "1" }
          : {}),
      },
      stdio: "inherit",
    });
    if (r.status !== 0) fail(`build-failed:${args.join(" ")}`);
  }
}

ensureBuild();

// --- 1) Real file IO via vitest + project-file-service ---
{
  const vitest = runVitest(
    desktopRoot,
    [
      "run",
      "--project",
      "node",
      "src/__tests__/lifecycle-file-io.test.ts",
    ],
    { cwd: desktopRoot },
  );
  if (vitest.status !== 0) {
    fail("lifecycle-file-io-vitest", {
      status: vitest.status,
      tail: `${vitest.stdout}\n${vitest.stderr}`.slice(-2000),
    });
  }
}

// --- 2) Export CLI ---
let electronPath;
try {
  electronPath = require("electron");
} catch {
  fail("electron-missing");
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "mv-e2e-life-"));
const exportOut = path.join(work, "demo.mp4");
const cli = path.join(desktopRoot, "resources", "export-cli", "cli-export.cjs");
const ffmpegBin = path.join(
  desktopRoot,
  "resources",
  "export-cli",
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
);
const bakedProject = path.join(work, "baked.project.json");
const exportOutDir = path.join(work, "export-out");
fs.mkdirSync(exportOutDir, { recursive: true });

const minimalProject = {
  format: "motion-project",
  formatVersion: 2,
  metadata: {
    id: "e2e_export",
    name: "E2E",
    aspectRatio: "16:9",
    fps: 24,
    locale: "vi-VN",
    brand: { name: "E2E", primaryColor: "#111", fontFamily: "Arial" },
  },
  dependencies: { components: [] },
  assets: [],
  variables: [],
  timeline: { sceneOrder: ["scene_e2e"], audioTracks: [] },
  scenes: [
    {
      id: "scene_e2e",
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
          payload: { text: "E2E", fontSize: 24, fontWeight: 600, align: "left" },
          style: { fill: "#ffffff" },
        },
      ],
      clips: [],
    },
  ],
  bindings: [],
  extensions: { constraints: [], events: [] },
};
fs.writeFileSync(bakedProject, JSON.stringify(minimalProject));

const exp = spawnSync(electronPath, [cli, bakedProject], {
  encoding: "utf8",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    FFMPEG_BIN: ffmpegBin,
    NODE_PATH: path.join(path.dirname(cli), "node_modules"),
    MOTIONVIDEO_EXPORT_OUT_DIR: exportOutDir,
    MOTIONVIDEO_EXPORT_ASSET_BASE: work,
    MOTIONVIDEO_EXPORT_MP4_PATH: exportOut,
    MOTIONVIDEO_EXPORT_FPS: "8",
    MOTIONVIDEO_EXPORT_SCALE: "0.25",
  },
  cwd: path.dirname(cli),
  timeout: 120_000,
});
let expResult = null;
for (const line of (exp.stdout || "").split(/\r?\n/).reverse()) {
  const t = line.trim();
  if (!t.startsWith("{")) continue;
  try {
    expResult = JSON.parse(t);
    break;
  } catch {
    /* continue */
  }
}
if (!expResult?.ok || !fs.existsSync(expResult.mp4Path ?? exportOut)) {
  fail("export-failed", {
    status: exp.status,
    result: expResult,
    tail: `${exp.stdout}\n${exp.stderr}`.slice(-1500),
  });
}

// --- 3) Dirty close branches (Vite prod + preload; not NSIS) ---
const runner = `
const { app, BrowserWindow, ipcMain } = require("electron");
const { pathToFileURL } = require("node:url");
const { join } = require("node:path");
const { writeFileSync } = require("node:fs");
const outPath = join(__dirname, "../tmp/e2e-lifecycle-window.json");
const indexHtml = join(__dirname, "../dist-renderer/index.html");
const preload = join(__dirname, "../dist/preload/index.js");

function done(payload) {
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  app.exit(payload.ok ? 0 : 1);
}

const watchdog = setTimeout(() => done({ ok: false, reason: "timeout" }), 60000);

function wrapOk(value) {
  return { ok: true, value };
}

app.whenReady().then(async () => {
  try {
    let saveMode = "ok"; // "ok" | "fail"
    const closeCalls = [];

    ipcMain.handle("desktop:getInfo", async () =>
      wrapOk({
        platform: process.platform,
        version: "e2e",
        packaged: false,
        renderer: "vite",
      }),
    );
    ipcMain.handle("desktop:confirmClose", async (_e, payload) => {
      closeCalls.push(payload && typeof payload === "object" ? payload.ok : null);
      return wrapOk(undefined);
    });
    ipcMain.handle("desktop:project.save", async () => {
      if (saveMode === "fail") {
        return {
          ok: false,
          error: {
            __desktopIpcError: true,
            code: "SAVE_FAILED",
            message: "e2e-save-forced-fail",
          },
        };
      }
      return wrapOk({ path: "C:\\\\e2e\\\\saved.mt" });
    });
    ipcMain.handle("desktop:project.saveAs", async () => {
      if (saveMode === "fail") {
        return {
          ok: false,
          error: {
            __desktopIpcError: true,
            code: "SAVE_FAILED",
            message: "e2e-save-forced-fail",
          },
        };
      }
      return wrapOk({ path: "C:\\\\e2e\\\\saved-as.mt" });
    });
    for (const ch of [
      "desktop:project.getRecent",
      "desktop:project.new",
      "desktop:windowMinimize",
      "desktop:windowMaximize",
      "desktop:windowClose",
      "desktop:windowIsMaximized",
      "desktop:journal.status",
      "desktop:journal.record",
      "desktop:journal.autosave",
      "desktop:journal.discard",
      "desktop:journal.recover",
    ]) {
      ipcMain.handle(ch, async () => {
        if (ch === "desktop:project.getRecent") return wrapOk([]);
        if (ch === "desktop:journal.record") return wrapOk({ recorded: false });
        if (ch === "desktop:journal.autosave") return wrapOk({ saved: false });
        if (ch === "desktop:journal.discard") return wrapOk(undefined);
        if (ch === "desktop:journal.status")
          return wrapOk({
            enabled: false,
            dirty: false,
            lastSeq: 0,
            hasRecoverableSnapshot: false,
          });
        if (ch === "desktop:windowIsMaximized") return wrapOk(false);
        return wrapOk(undefined);
      });
    }

    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      show: false,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });

    async function bootEditor() {
      await win.loadURL(pathToFileURL(indexHtml).href + "?fixture=editor-shell");
      const ready = await win.webContents.executeJavaScript(\`
        new Promise((resolve) => {
          const start = Date.now();
          const tick = () => {
            const el = document.querySelector('[data-app-ready="true"][data-ui-fixture="editor-shell"]');
            if (el) resolve(true);
            else if (Date.now() - start > 15000) resolve(false);
            else setTimeout(tick, 50);
          };
          tick();
        })
      \`);
      if (!ready) throw new Error("app-not-ready");
    }

    async function probeClose(confirmResult) {
      closeCalls.length = 0;
      await win.webContents.executeJavaScript(\`
        window.__e2eAsked = false;
        window.__e2eConfirmResult = \${confirmResult ? "true" : "false"};
        window.confirm = (msg) => {
          window.__e2eAsked = true;
          window.__e2eConfirmMsg = String(msg || "");
          return window.__e2eConfirmResult;
        };
        true
      \`);
      win.webContents.send("desktop:requestCloseSave");
      await new Promise((r) => setTimeout(r, 900));
      return win.webContents.executeJavaScript(\`
        ({
          asked: Boolean(window.__e2eAsked),
          msg: window.__e2eConfirmMsg || "",
          hasBridge: Boolean(window.motionvideoDesktop),
        })
      \`);
    }

    const branches = {};

    // Cancel → stay open (confirmClose false)
    await bootEditor();
    saveMode = "ok";
    const cancelProbe = await probeClose(false);
    if (!cancelProbe.asked) throw new Error("cancel-confirm-not-asked");
    if (closeCalls[closeCalls.length - 1] !== false) {
      throw new Error("cancel-expected-confirmClose-false got=" + closeCalls.join(","));
    }
    branches.cancel = { asked: true, confirmCloseOk: false };

    // Save ok → confirmClose true
    await bootEditor();
    saveMode = "ok";
    const saveOkProbe = await probeClose(true);
    if (!saveOkProbe.asked) throw new Error("save-ok-confirm-not-asked");
    await new Promise((r) => setTimeout(r, 400));
    if (closeCalls[closeCalls.length - 1] !== true) {
      throw new Error("save-ok-expected-confirmClose-true got=" + closeCalls.join(","));
    }
    branches.saveOk = { asked: true, confirmCloseOk: true };

    // Save fail → confirmClose false (window stays)
    await bootEditor();
    saveMode = "fail";
    const saveFailProbe = await probeClose(true);
    if (!saveFailProbe.asked) throw new Error("save-fail-confirm-not-asked");
    await new Promise((r) => setTimeout(r, 400));
    if (closeCalls[closeCalls.length - 1] !== false) {
      throw new Error("save-fail-expected-confirmClose-false got=" + closeCalls.join(","));
    }
    branches.saveFail = { asked: true, confirmCloseOk: false };

    clearTimeout(watchdog);
    done({
      ok: true,
      probe: { asked: true, ...branches },
      note: "Vite prod lifecycle — not NSIS packaged",
    });
  } catch (err) {
    clearTimeout(watchdog);
    done({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
});
`;

const runnerPath = path.join(desktopRoot, "tmp", "_e2e-lifecycle-runner.cjs");
fs.mkdirSync(path.dirname(runnerPath), { recursive: true });
fs.writeFileSync(runnerPath, runner);

const env = {
  ...process.env,
  MOTIONVIDEO_VITE_PROD: "1",
  VITE_ENABLE_UI_FIXTURES: "1",
};
delete env.ELECTRON_RUN_AS_NODE;

await new Promise((resolve, reject) => {
  const child = spawn(electronPath, [runnerPath], {
    cwd: desktopRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`window-probe-exit-${code}`));
  });
}).catch((err) => fail(String(err.message || err)));

const windowResult = JSON.parse(
  fs.readFileSync(
    path.join(desktopRoot, "tmp", "e2e-lifecycle-window.json"),
    "utf8",
  ),
);
if (!windowResult.ok || !windowResult.probe?.asked) {
  fail("dirty-close-assert", windowResult);
}

ok({
  steps: [
    "file-io-project-service",
    "export-cli",
    "dirty-close-cancel",
    "dirty-close-save-ok",
    "dirty-close-save-fail",
  ],
  exportBytes: fs.statSync(expResult.mp4Path ?? exportOut).size,
  window: windowResult,
  note: "Vite prod lifecycle E2E (not NSIS packaged). Envelope via lifecycle-file-io.test.ts. Dist worker: pnpm test:journal-worker. Packaged dir worker: pnpm test:journal-worker:packaged.",
  hash: createHash("sha256").update("e2e-lifecycle").digest("hex").slice(0, 8),
});
