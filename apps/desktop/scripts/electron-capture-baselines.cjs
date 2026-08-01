/**
 * Capture production Hub/Editor screenshots via Electron (P20).
 * Requires dist-renderer built with VITE_ENABLE_UI_FIXTURES=1.
 *
 * Usage: electron scripts/electron-capture-baselines.cjs
 */

const { app, BrowserWindow } = require("electron");
const { createHash } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const desktopRoot = join(__dirname, "..");
const outDir = join(desktopRoot, "../../docs/migration/vite-ui/baselines");
const indexHtml = join(desktopRoot, "dist-renderer/index.html");

const surfaces = [
  "hub-empty",
  "hub-recent",
  "editor-shell",
  "sidebar-layers",
  "timeline-empty",
];
const sizes = [
  { w: 1280, h: 720, tag: "1280" },
  { w: 1920, h: 1080, tag: "1920" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.whenReady().then(async () => {
  mkdirSync(outDir, { recursive: true });
  const files = [];

  for (const surface of surfaces) {
    for (const { w, h, tag } of sizes) {
      const win = new BrowserWindow({
        width: w,
        height: h,
        show: false,
        frame: false,
        backgroundColor: "#0A0A0B",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      const url = `${pathToFileURL(indexHtml).href}?fixture=${surface}`;
      await win.loadURL(url);
      const ready = await win.webContents
        .executeJavaScript(
          `new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
              const el = document.querySelector('[data-app-ready="true"][data-ui-fixture="${surface}"]');
              if (el) resolve(true);
              else if (Date.now() - start > 8000) resolve(false);
              else requestAnimationFrame(tick);
            };
            tick();
          })`,
        )
        .catch(() => false);
      if (!ready) {
        console.error(
          `[electron-capture-baselines] fixture not ready: ${surface}`,
        );
        app.exit(1);
        return;
      }
      await sleep(200);
      const image = await win.webContents.capturePage();
      const buf = image.toPNG();
      const name = `${surface}-${tag}.png`;
      writeFileSync(join(outDir, name), buf);
      files.push({
        name,
        width: w,
        height: h,
        sha256: createHash("sha256").update(buf).digest("hex"),
        kind: "production-ui-electron",
      });
      win.destroy();
    }
  }

  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        status: "electron-production-ui",
        note: "Captured real HubScreen / EditingWorkspace with VITE_ENABLE_UI_FIXTURES=1 and frame:false.",
        tolerance: { maxPixelDiffRatio: 0.02 },
        generatedAt: new Date().toISOString(),
        placeholders: "baselines/placeholders/",
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `[electron-capture-baselines] Wrote ${files.length} PNGs under ${outDir}`,
  );
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
