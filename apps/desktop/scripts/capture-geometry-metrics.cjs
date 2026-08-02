/**
 * CSS-0: capture Vite chrome geometry (+ optional screenshot) for reference-web/metrics.
 * Writes docs/migration/vite-ui/reference-web/metrics/vite-<surface>-<WxH>.json
 *
 * Usage (from apps/desktop, fixtures build):
 *   VITE_ENABLE_UI_FIXTURES=1 pnpm build:renderer
 *   node scripts/capture-geometry-metrics.cjs
 */

const { app, BrowserWindow } = require("electron");
const { createHash } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const desktopRoot = join(__dirname, "..");
const indexHtml = join(desktopRoot, "dist-renderer/index.html");
const outMetrics = join(
  desktopRoot,
  "../../docs/migration/vite-ui/reference-web/metrics",
);
const outPng = join(
  desktopRoot,
  "../../docs/migration/vite-ui/reference-web/vite",
);

const surfaces = ["home-empty", "home-recent", "editor-shell", "timeline-empty"];
const sizes = [
  { w: 1280, h: 720 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

const GEOMETRY_KEYS = [
  "titlebar",
  "sidebar",
  "stage",
  "timeline",
  "inspector",
  "center",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function roundRect(r) {
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    left: Math.round(r.left),
    bottom: Math.round(r.bottom),
    right: Math.round(r.right),
  };
}

app.whenReady().then(async () => {
  mkdirSync(outMetrics, { recursive: true });
  mkdirSync(outPng, { recursive: true });
  const files = [];

  for (const surface of surfaces) {
    for (const { w, h } of sizes) {
      const win = new BrowserWindow({
        width: w,
        height: h,
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
        win.setPosition(40, 40);
        win.setContentSize(w, h);
      } catch {
        /* ignore */
      }
      await win.loadURL(
        `${pathToFileURL(indexHtml).href}?fixture=${surface}`,
      );
      try {
        win.setContentSize(w, h);
      } catch {
        /* ignore */
      }
      await sleep(600);
      const ready = await win.webContents
        .executeJavaScript(
          `!!document.querySelector('[data-app-ready="true"][data-ui-fixture="${surface}"]')`,
        )
        .catch(() => false);
      if (!ready) {
        console.error(`[capture-geometry] not ready ${surface}@${w}x${h}`);
        win.destroy();
        app.exit(1);
        return;
      }

      const metrics = await win.webContents.executeJavaScript(`
        (() => {
          const keys = ${JSON.stringify(GEOMETRY_KEYS)};
          const regions = {};
          const styles = {};
          for (const key of keys) {
            const el = document.querySelector('[data-geometry="' + key + '"]');
            if (!el) continue;
            const r = el.getBoundingClientRect();
            regions[key] = {
              x: r.x, y: r.y, width: r.width, height: r.height,
              top: r.top, left: r.left, bottom: r.bottom, right: r.right,
            };
            const cs = getComputedStyle(el);
            styles[key] = {
              backgroundColor: cs.backgroundColor,
              borderRadius: cs.borderRadius,
              fontSize: cs.fontSize,
              lineHeight: cs.lineHeight,
              fontFamily: cs.fontFamily,
            };
          }
          const root = getComputedStyle(document.documentElement);
          const tokens = {
            sidebarDefault: root.getPropertyValue('--desktop-sidebar-default-w').trim(),
            inspectorDefault: root.getPropertyValue('--desktop-inspector-default-w').trim(),
            timelineDefault: root.getPropertyValue('--desktop-timeline-default-h').trim(),
            titlebarH: root.getPropertyValue('--desktop-titlebar-h').trim(),
            panelGap: root.getPropertyValue('--desktop-panel-gap').trim(),
            panelRadius: root.getPropertyValue('--desktop-panel-radius').trim(),
          };
          return {
            source: "vite",
            surface: "${surface}",
            viewport: { width: window.innerWidth, height: window.innerHeight },
            regions,
            styles,
            tokens,
          };
        })()
      `);

      // Round for stable JSON
      for (const k of Object.keys(metrics.regions ?? {})) {
        metrics.regions[k] = roundRect(metrics.regions[k]);
      }

      const tag = `${surface}-${w}x${h}`;
      const jsonName = `vite-${tag}.json`;
      writeFileSync(
        join(outMetrics, jsonName),
        `${JSON.stringify(metrics, null, 2)}\n`,
      );

      const image = await win.webContents.capturePage();
      const size = image.getSize();
      if (size.width === w && size.height === h) {
        const png = image.toPNG();
        const pngName = `vite-${tag}.png`;
        writeFileSync(join(outPng, pngName), png);
        files.push({
          metrics: jsonName,
          png: pngName,
          sha256: createHash("sha256").update(png).digest("hex"),
        });
      } else {
        files.push({
          metrics: jsonName,
          png: null,
          note: `size mismatch ${size.width}x${size.height}`,
        });
      }
      win.destroy();
    }
  }

  writeFileSync(
    join(outMetrics, "vite-index.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Vite chrome geometry for CSS-0. Web target metrics live in web-contract.json until full legacy capture.",
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `[capture-geometry] wrote ${files.length} vite metrics → ${outMetrics}`,
  );
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
