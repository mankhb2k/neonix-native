/**
 * CSS-0: capture legacy web desktop screenshots into reference-web/web/.
 * Requires Playwright (apps/web) + Next on PLAYWRIGHT_BASE_URL.
 * Does NOT modify apps/web/components/desktop/**.
 *
 * node scripts/capture-reference-web.mjs
 */

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopRoot, "../..");
const outDir = join(repoRoot, "docs/migration/vite-ui/reference-web/web");
mkdirSync(outDir, { recursive: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const sizes = [
  { w: 1280, h: 720 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

const surfaces = [{ id: "hub", path: "/app" }];

function writeStatus(payload) {
  writeFileSync(
    join(outDir, "CAPTURE_STATUS.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    join(repoRoot, "apps/web"),
    join(repoRoot, "node_modules/playwright"),
    join(desktopRoot, "node_modules/playwright"),
  ];
  for (const base of candidates) {
    try {
      if (base.endsWith("playwright") && existsSync(join(base, "package.json"))) {
        return require(base);
      }
      return createRequire(join(base, "package.json"))("playwright");
    } catch {
      /* try next */
    }
  }
  return null;
}

async function main() {
  const required = process.env.REFERENCE_WEB_REQUIRED === "1";
  const playwright = loadPlaywright();
  if (!playwright) {
    writeStatus({
      ok: false,
      reason: "playwright-missing",
      hint: "Install Playwright in the workspace, or drop PNGs manually under reference-web/web/",
      softSkip: !required,
      note: required
        ? "REFERENCE_WEB_REQUIRED=1 — failing hard"
        : "Soft skip (not a CI gate). Set REFERENCE_WEB_REQUIRED=1 to fail.",
      generatedAt: new Date().toISOString(),
    });
    if (required) {
      console.error(
        "[capture-reference-web] playwright missing (REFERENCE_WEB_REQUIRED=1)",
      );
      process.exit(1);
    }
    console.warn(
      "[capture-reference-web] skipped — playwright missing (soft; not a CI gate)",
    );
    return;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const captured = [];

  try {
    for (const surface of surfaces) {
      for (const { w, h } of sizes) {
        const page = await browser.newPage({
          viewport: { width: w, height: h },
        });
        const url = `${baseURL}${surface.path}`;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.waitForTimeout(500);
          const name = `${surface.id}-${w}x${h}.png`;
          await page.screenshot({ path: join(outDir, name), fullPage: false });
          captured.push(name);
        } catch (err) {
          captured.push({
            surface: surface.id,
            size: `${w}x${h}`,
            error: String(err?.message ?? err),
          });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const ok = captured.every((c) => typeof c === "string");
  writeStatus({
    ok,
    baseURL,
    captured,
    generatedAt: new Date().toISOString(),
  });
  console.log(
    "[capture-reference-web] done",
    captured.length,
    "entries →",
    outDir,
  );
  if (!ok && required) process.exit(1);
}

main().catch((err) => {
  writeStatus({ ok: false, error: String(err), generatedAt: new Date().toISOString() });
  console.error("[capture-reference-web]", err);
  process.exit(1);
});
