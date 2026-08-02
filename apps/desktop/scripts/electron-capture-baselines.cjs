/**
 * Capture production Hub/Editor screenshots via Electron (UI-0).
 * Writes candidates under apps/desktop/tmp/baseline-candidates/.
 * Promotes to docs/.../baselines/ only when PROMOTE_BASELINES=1.
 *
 * Requires dist-renderer built with VITE_ENABLE_UI_FIXTURES=1.
 * Fails if capture size !== requested (no 1920×1032 under *-1920 names).
 */

const { app, BrowserWindow } = require("electron");
const { createHash } = require("node:crypto");
const { copyFileSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const desktopRoot = join(__dirname, "..");
const candidateDir = join(desktopRoot, "tmp/baseline-candidates");
const referenceDir = join(
  desktopRoot,
  "../../docs/migration/vite-ui/baselines",
);
const indexHtml = join(desktopRoot, "dist-renderer/index.html");
const promote = process.env.PROMOTE_BASELINES === "1";

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function surfaceReadyScript(surface) {
  return `new Promise((resolve) => {
    const inViewport = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (
        r.height > 0 &&
        r.width > 0 &&
        r.top >= 0 &&
        r.bottom <= window.innerHeight + 1 &&
        r.left >= 0 &&
        r.right <= window.innerWidth + 1
      );
    };
    const start = Date.now();
    const tick = () => {
      const root = document.querySelector('[data-app-ready="true"][data-ui-fixture="${surface}"]');
      const bodyText = document.body ? document.body.innerText : "";
      if (bodyText.includes("Starting…") || bodyText.includes("Starting...")) {
        if (Date.now() - start > 12000) resolve({ ok: false, reason: "still-starting" });
        else requestAnimationFrame(tick);
        return;
      }
      if (!root) {
        if (Date.now() - start > 12000) resolve({ ok: false, reason: "no-ready" });
        else requestAnimationFrame(tick);
        return;
      }

      let surfaceOk = false;
      let reason = "surface-missing";

      if ("${surface}".startsWith("home-")) {
        const home = document.querySelector("[data-home-screen]");
        surfaceOk = !!home && inViewport(home);
        reason = surfaceOk ? "ok" : "home-out-of-view";
      } else {
        const timeline = document.querySelector('[data-testid="timeline-viewport"]');
        if (!timeline || !inViewport(timeline)) {
          reason = "timeline-out-of-view";
        } else if ("${surface}" === "sidebar-layers") {
          surfaceOk = !!document.querySelector('[data-sidebar-tab="layers"]');
          reason = surfaceOk ? "ok" : "layers-tab-missing";
        } else if ("${surface}" === "timeline-empty") {
          surfaceOk = !!document.querySelector('[data-timeline-focus="true"]');
          reason = surfaceOk ? "ok" : "timeline-focus-missing";
        } else if ("${surface}" === "editor-shell") {
          const clip = document.querySelector('[data-testid="timeline-clip-strip"][data-clip-id]');
          surfaceOk = !!clip && inViewport(clip);
          reason = surfaceOk ? "ok" : "clip-out-of-view";
        } else {
          surfaceOk = true;
          reason = "ok";
        }
      }

      if (surfaceOk) resolve({ ok: true });
      else if (Date.now() - start > 12000) resolve({ ok: false, reason });
      else requestAnimationFrame(tick);
    };
    tick();
  })`;
}

app.whenReady().then(async () => {
  rmSync(candidateDir, { recursive: true, force: true });
  mkdirSync(candidateDir, { recursive: true });
  mkdirSync(referenceDir, { recursive: true });
  const files = [];
  const shaBySize = new Map();

  for (const surface of surfaces) {
    for (const { w, h, tag } of sizes) {
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
      const url = `${pathToFileURL(indexHtml).href}?fixture=${surface}`;
      await win.loadURL(url);
      try {
        win.setContentSize(w, h);
      } catch {
        /* ignore */
      }
      const ready = await win.webContents
        .executeJavaScript(surfaceReadyScript(surface))
        .catch((err) => ({ ok: false, reason: String(err) }));
      if (!ready || !ready.ok) {
        console.error(
          `[electron-capture-baselines] fixture not ready: ${surface}@${tag}`,
          ready,
        );
        win.destroy();
        app.exit(1);
        return;
      }
      await sleep(400);
      const image = await win.webContents.capturePage();
      const buf = image.toPNG();
      const size = image.getSize();
      if (size.width !== w || size.height !== h) {
        console.error(
          `[electron-capture-baselines] size mismatch ${surface}@${tag}: got ${size.width}x${size.height}, want ${w}x${h}`,
        );
        win.destroy();
        app.exit(1);
        return;
      }
      const name = `${surface}-${tag}.png`;
      const sha = createHash("sha256").update(buf).digest("hex");
      writeFileSync(join(candidateDir, name), buf);

      if (!shaBySize.has(tag)) shaBySize.set(tag, new Map());
      const bucket = shaBySize.get(tag);
      if (bucket.has(sha)) {
        console.error(
          `[electron-capture-baselines] duplicate SHA across surfaces at ${tag}:`,
          bucket.get(sha),
          "and",
          name,
        );
        win.destroy();
        app.exit(1);
        return;
      }
      bucket.set(sha, name);

      files.push({
        name,
        width: w,
        height: h,
        sha256: sha,
        kind: "production-ui-electron",
      });
      win.destroy();
    }
  }

  const candidateManifest = {
    status: "electron-production-ui-candidates",
    note: "Candidates only. Promote with PROMOTE_BASELINES=1 after visual review.",
    tolerance: { maxPixelDiffRatio: 0.02 },
    generatedAt: new Date().toISOString(),
    files,
  };
  writeFileSync(
    join(candidateDir, "manifest.json"),
    `${JSON.stringify(candidateManifest, null, 2)}\n`,
  );

  if (promote) {
    for (const entry of files) {
      copyFileSync(
        join(candidateDir, entry.name),
        join(referenceDir, entry.name),
      );
    }
    writeFileSync(
      join(referenceDir, "manifest.json"),
      `${JSON.stringify(
        {
          status: "electron-production-ui",
          note: "Reference goldens at exact requested sizes. Compare via sharp PNG pixel-diff.",
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
      `[electron-capture-baselines] Promoted ${files.length} PNGs → ${referenceDir}`,
    );
  } else {
    console.log(
      `[electron-capture-baselines] Wrote ${files.length} candidates → ${candidateDir} (set PROMOTE_BASELINES=1 to update references)`,
    );
  }
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
