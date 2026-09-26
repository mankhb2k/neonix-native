import { chromium, type Browser, type Page } from "playwright";
import {
  LAYOUT_PROBE_ID_ATTRIBUTE,
  parseNeonixDocument,
  runLayoutProbe,
  type HtmlCompilerFontAsset,
  type LayoutProbeResult,
} from "@motionvideo/html-compiler";

export type LayoutProbeJobRequest = {
  jobId: string;
  /** Already stamped by the caller via stampNodeIds() - this worker only measures. */
  html: string;
  fontAssets?: readonly HtmlCompilerFontAsset[];
};

export type LayoutProbeJobResult = {
  jobId: string;
  snapshot: LayoutProbeResult;
  elapsedMilliseconds: number;
};

function fontFaceCss(fontAssets: readonly HtmlCompilerFontAsset[]): string {
  return fontAssets
    .map((asset) => `@font-face { font-family: "${asset.family}"; src: url("${asset.uri}") format("truetype"); font-style: ${asset.style}; font-weight: ${asset.weight};${asset.stretch ? ` font-stretch: ${asset.stretch};` : ""} }`)
    .join("\n");
}

/** Same injection technique apps/web's ComparePreviewLab/withNativeStage uses for its own browser-reference iframe - keeps this service measuring against the same font catalog the compiler resolves against. */
function injectFontFaces(html: string, fontAssets: readonly HtmlCompilerFontAsset[]): string {
  if (fontAssets.length === 0) return html;
  const styleTag = `<style data-layout-probe-fonts>${fontFaceCss(fontAssets)}</style>`;
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, `${styleTag}</head>`);
  return html.replace(/<body[^>]*>/i, (match) => `${styleTag}${match}`);
}

// One Chromium instance for the process lifetime - safe under the
// concurrency=1 Cloud Run setting this service is meant to run with (see
// README.md), and avoids a ~200-500ms relaunch per job.
let sharedBrowser: Browser | undefined;
async function getBrowser(): Promise<Browser> {
  sharedBrowser ??= await chromium.launch({ headless: true });
  return sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (!sharedBrowser) return;
  const browser = sharedBrowser;
  sharedBrowser = undefined;
  await browser.close();
}

/**
 * Measures real-browser layout geometry for an already-stamped HTML
 * document. Mirrors packages/export-renderer/src/media/media-worker.ts's
 * prepareMediaJob() shape: one job in, one result out, no shared state
 * beyond the browser instance itself.
 */
/**
 * `tsx` (this service's runtime - see package.json's "start" script) runs
 * source through esbuild with name-preservation on, which wraps any nested
 * arrow function assigned to a const in a `__name(fn, "name")` helper call
 * (purely cosmetic - it just sets `.name` and returns `fn` unchanged). That
 * helper only exists in tsx's own module scope, so `runLayoutProbe`'s
 * `Function.prototype.toString()` - which is exactly what `page.evaluate`
 * sends into the browser when given a function reference - throws
 * `__name is not defined` once it's re-evaluated in the isolated page
 * context. html-compiler's layout-probe.ts stays untouched (it works fine
 * under whatever transform apps/web's Playwright tests use); the shim
 * belongs here, next to the one runtime that actually needs it.
 */
/**
 * Native's root containing block is ALWAYS composition.width/height,
 * completely independent of whatever html/body CSS the document itself
 * declares (`compile.ts`'s `rootContainingBlock = compositionRect(width,
 * height)` never reads html/body's own resolved box - see ARCHITECHTURE.md).
 * The measurement environment must match that invariant exactly, or a real
 * user document that happens to declare its own partial html/body reset
 * (plausible, not an edge case - e.g. just `body { margin: 0 }` for their
 * own convenience) would get measured against ITS OWN body size instead of
 * composition size, silently corrupting every percentage-based value.
 *
 * This is injected via `addStyleTag` AFTER `setContent` (guaranteeing it is
 * last in cascade/source order) with `!important` on every property, so it
 * always wins regardless of what the document declares - unlike
 * `ensureBrowserPreviewBodyStyle` (a preview-convenience helper that
 * deliberately SKIPS itself once the document already declares its own
 * reset, and documents itself as not load-bearing for correctness - it is
 * the wrong tool for this measurement service specifically).
 */
async function forceCompositionCanvas(page: Page, width: number, height: number): Promise<void> {
  await page.addStyleTag({
    content: `html, body { width: ${width}px !important; height: ${height}px !important; margin: 0 !important; overflow: hidden !important; }`,
  });
}

async function evaluateLayoutProbe(page: Page, idAttribute: string): Promise<LayoutProbeResult> {
  return page.evaluate(
    ({ source, idAttribute: attribute }) => {
      (globalThis as Record<string, unknown>).__name ??= (fn: unknown) => fn;
      // eslint-disable-next-line @typescript-eslint/no-implied-eval -- reconstructing a function whose source came from our own trusted, imported module, not user input.
      const reconstructed = new Function(`return (${source})`)() as (attr: string) => LayoutProbeResult;
      return reconstructed(attribute);
    },
    { source: runLayoutProbe.toString(), idAttribute },
  );
}

export async function runLayoutProbeJob(request: LayoutProbeJobRequest): Promise<LayoutProbeJobResult> {
  const startedAt = performance.now();
  const { composition } = parseNeonixDocument({ html: request.html });
  const fontAssets = request.fontAssets ?? [];
  const stagedHtml = injectFontFaces(request.html, fontAssets);

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: composition.width, height: composition.height } });
  try {
    const page = await context.newPage();
    await page.setContent(stagedHtml, { waitUntil: "domcontentloaded" });
    await forceCompositionCanvas(page, composition.width, composition.height);
    await page.evaluate(() => document.fonts.ready);
    const snapshot = await evaluateLayoutProbe(page, LAYOUT_PROBE_ID_ATTRIBUTE);
    return { jobId: request.jobId, snapshot, elapsedMilliseconds: Math.round(performance.now() - startedAt) };
  } finally {
    await context.close();
  }
}
