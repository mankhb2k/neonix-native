/**
 * Capture FixtureSurface screenshots via Electron (no Playwright browsers).
 * Usage: electron scripts/electron-capture-baselines.cjs
 * (cwd = apps/desktop; dist-renderer must exist)
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
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      const url = `${pathToFileURL(indexHtml).href}?fixture=${surface}`;
      await win.loadURL(url);
      await sleep(400);
      try {
        await win.webContents.executeJavaScript(
          `document.querySelector('[data-fixture="${surface}"]') != null`,
        );
      } catch {
        /* continue */
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
        kind: "fixture-electron",
      });
      win.destroy();
    }
  }

  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        status: "electron-captured",
        note: "Captured FixtureSurface via Electron BrowserWindow + dist-renderer (?fixture=).",
        tolerance: { maxPixelDiffRatio: 0.02 },
        generatedAt: new Date().toISOString(),
        placeholders: "baselines/placeholders/",
        files,
      },
      null,
      2,
    )}\n`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[electron-capture-baselines] Wrote ${files.length} PNGs under ${outDir}`,
  );
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
