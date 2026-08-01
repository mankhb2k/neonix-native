/**
 * Capture production Hub/Editor screenshots via Electron (P20/B1).
 * Writes candidates under apps/desktop/tmp/baseline-candidates/.
 * Promotes to docs/.../baselines/ only when PROMOTE_BASELINES=1.
 *
 * Requires dist-renderer built with VITE_ENABLE_UI_FIXTURES=1.
 */

const { app, BrowserWindow, nativeImage } = require("electron");
const { createHash } = require("node:crypto");
const {
  copyFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} = require("node:fs");
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

function electronEnvClean() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function surfaceReadyScript(surface) {
  return `new Promise((resolve) => {
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
      if ("${surface}".startsWith("hub-")) {
        surfaceOk = !!document.querySelector("[data-hub-screen]");
      } else if ("${surface}" === "sidebar-layers") {
        surfaceOk =
          !!document.querySelector('[data-sidebar-tab="layers"]') &&
          !!document.querySelector('[data-testid="timeline-viewport"]');
      } else if ("${surface}" === "timeline-empty") {
        surfaceOk =
          !!document.querySelector('[data-timeline-focus="true"]') &&
          !!document.querySelector('[data-testid="timeline-viewport"]');
      } else {
        surfaceOk = !!document.querySelector('[data-testid="timeline-viewport"]');
      }
      if (surfaceOk) resolve({ ok: true });
      else if (Date.now() - start > 12000) resolve({ ok: false, reason: "surface-missing" });
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
        backgroundColor: "#0A0A0B",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      try {
        win.setPosition(40, 40);
      } catch {
        /* ignore */
      }
      const url = `${pathToFileURL(indexHtml).href}?fixture=${surface}`;
      await win.loadURL(url);
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
      const bitmap = image.toBitmap();
      const size = image.getSize();
      const name = `${surface}-${tag}.png`;
      const sha = createHash("sha256").update(buf).digest("hex");
      writeFileSync(join(candidateDir, name), buf);
      writeFileSync(
        join(candidateDir, `${surface}-${tag}.bgra`),
        Buffer.concat([
          Buffer.from(`${size.width}x${size.height}\n`, "utf8"),
          bitmap,
        ]),
      );

      const sizeKey = `${tag}`;
      if (!shaBySize.has(sizeKey)) shaBySize.set(sizeKey, new Map());
      const bucket = shaBySize.get(sizeKey);
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
        width: size.width,
        height: size.height,
        requestedWidth: w,
        requestedHeight: h,
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
      // Do not promote .bgra (large); pixel-diff uses candidates' bgra vs
      // re-decoded reference via PNG SHA / local bgra when both present.
    }
    writeFileSync(
      join(referenceDir, "manifest.json"),
      `${JSON.stringify(
        {
          status: "electron-production-ui",
          note: "Reference goldens promoted from candidates. Compare against tmp/baseline-candidates.",
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
