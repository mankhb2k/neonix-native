// Bakes a real-Chromium layout measurement for every fixture in the docs/
// playground catalog into a single committed JSON file, so
// html-compiler-layout-snapshot-diff.mjs (and any test) can compare native
// vs layoutSnapshot compilation WITHOUT needing a live browser at test time.
// Uses the exact same measurement path production would (stampNodeIds +
// runLayoutProbe from @motionvideo/html-compiler) - only the browser
// (Playwright's bundled Chromium, same version pinned in
// infra/cloud-run/layout-probe's Docker image) differs from a real
// deployment, and that binary is identical regardless of where it runs.
//
// Re-run this whenever a fixture changes, or periodically to catch drift
// from a Chromium/Playwright version bump.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  LAYOUT_PROBE_ID_ATTRIBUTE,
  ensureBrowserPreviewBodyStyle,
  runLayoutProbe,
  stampNodeIds,
  type LayoutProbeResult,
} from "../../../packages/html-compiler/src/index.ts";
import { HTML_COMPILER_PREVIEW_CASES, HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview.ts";

const publicRoot = resolve(import.meta.dirname, "../public");
const outDir = resolve(import.meta.dirname, ".html-compiler-layout-snapshots");
mkdirSync(outDir, { recursive: true });

// Same tsx/esbuild __name-helper workaround as infra/cloud-run/layout-probe's
// probe-worker.ts - see that file's comment for why this is needed at all.
async function measure(page: Page): Promise<LayoutProbeResult> {
  return page.evaluate(
    ({ source, idAttribute }) => {
      (globalThis as Record<string, unknown>).__name ??= (fn: unknown) => fn;
      const reconstructed = new Function(`return (${source})`)() as (attr: string) => LayoutProbeResult;
      return reconstructed(idAttribute);
    },
    { source: runLayoutProbe.toString(), idAttribute: LAYOUT_PROBE_ID_ATTRIBUTE },
  );
}

const browser = await chromium.launch();
const snapshots: Record<string, { snapshot: LayoutProbeResult; stampedHtml: string }> = {};
let measured = 0;
let skipped = 0;

for (const fixture of HTML_COMPILER_PREVIEW_CASES) {
  const html = readFileSync(join(publicRoot, fixture.fixtureUrl.replace(/^\//, "")), "utf8");
  const stamped = stampNodeIds(html);
  const staged = ensureBrowserPreviewBodyStyle(stamped).html;
  const page = await browser.newPage({ viewport: { width: fixture.composition.width, height: fixture.composition.height } });
  try {
    // Same font-loading discipline the real service uses - injects @font-face
    // for the catalog's own fonts, waits for fonts.ready before measuring.
    // Fonts are served straight from disk via route interception (no dev
    // server dependency - this script must be self-contained).
    const fontOrigin = "https://layout-snapshot-bake.local";
    const fontFaceCss = HTML_COMPILER_PREVIEW_FONT_ASSETS
      .map((asset) => `@font-face { font-family: "${asset.family}"; src: url("${fontOrigin}${asset.uri}") format("truetype"); font-style: ${asset.style}; font-weight: ${asset.weight}; }`)
      .join("\n");
    const withFonts = /<\/head\s*>/i.test(staged)
      ? staged.replace(/<\/head\s*>/i, `<style>${fontFaceCss}</style></head>`)
      : `<head><style>${fontFaceCss}</style></head>${staged}`;
    await page.route(`${fontOrigin}/**`, async (route) => {
      const relativePath = new URL(route.request().url()).pathname;
      try {
        await route.fulfill({ path: join(publicRoot, relativePath.replace(/^\//, "")) });
      } catch {
        await route.abort();
      }
    });
    await page.setContent(withFonts, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const snapshot = await measure(page);
    snapshots[fixture.id] = { snapshot, stampedHtml: stamped };
    measured += 1;
  } catch (error) {
    console.error("SKIP", fixture.id, error instanceof Error ? error.message : String(error));
    skipped += 1;
  } finally {
    await page.close();
  }
}
await browser.close();

writeFileSync(join(outDir, "snapshots.json"), JSON.stringify(snapshots));
console.log(`measured ${measured}/${HTML_COMPILER_PREVIEW_CASES.length} fixtures, ${skipped} skipped`);
