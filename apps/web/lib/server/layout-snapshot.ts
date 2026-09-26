import "server-only";
import { appUrl } from "@/lib/hosts";
import {
  compileDocument,
  stampNodeIds,
  type HtmlCompilerFontAsset,
  type HtmlCompilerOptions,
  type HtmlCompilerResult,
  type HtmlDocumentInput,
  type LayoutSnapshot,
} from "@motionvideo/html-compiler";

const DEFAULT_TIMEOUT_MS = 5_000;

function isEnabled(): boolean {
  return process.env.LAYOUT_SNAPSHOT_ENABLED === "true";
}

/** Font asset `uri`s (e.g. "/preview/font/Inter/Inter-400.ttf") are only meaningful relative to this app's own public origin - resolve them to absolute URLs before handing them to a separate service that has no notion of that origin. */
function resolveFontAssetUrls(fontAssets: readonly HtmlCompilerFontAsset[]): HtmlCompilerFontAsset[] {
  return fontAssets.map((asset) => (/^https?:\/\//i.test(asset.uri) ? asset : { ...asset, uri: appUrl(asset.uri) }));
}

/**
 * Calls the layout-probe Cloud Run service (infra/cloud-run/layout-probe)
 * for a real-browser measurement of `stampedHtml`. Returns `undefined` on
 * ANY failure - disabled flag, missing config, network error, timeout,
 * non-2xx, or a response the service itself reported as failed - never
 * throws. This must never be the reason a save fails or hangs.
 */
export async function fetchLayoutSnapshot(jobId: string, stampedHtml: string, fontAssets: readonly HtmlCompilerFontAsset[]): Promise<LayoutSnapshot | undefined> {
  if (!isEnabled()) return undefined;
  const url = process.env.LAYOUT_SNAPSHOT_URL?.trim().replace(/\/$/, "");
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  if (!url || !token) return undefined;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.LAYOUT_SNAPSHOT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/v1/layout/probe`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-worker-token": token },
      body: JSON.stringify({ jobId, html: stampedHtml, fontAssets: resolveFontAssetUrls(fontAssets) }),
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { ok: boolean; snapshot?: LayoutSnapshot };
    return data.ok ? data.snapshot : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Drop-in replacement for `compileDocument()` at the HTML save path: stamps
 * `html` (inert to compiled output when no snapshot ends up available - see
 * layout-probe.test.ts in html-compiler), tries to get a real-browser
 * measurement for it, and compiles with `layoutSnapshot` set when one comes
 * back. Callers keep persisting the ORIGINAL `document.html`, never the
 * stamped copy used internally here.
 */
export async function compileHtmlWithLayoutSnapshot(document: HtmlDocumentInput, fontAssets: readonly HtmlCompilerFontAsset[], options: HtmlCompilerOptions = {}): Promise<HtmlCompilerResult> {
  const stamped = stampNodeIds(document.html);
  const jobId = globalThis.crypto.randomUUID();
  const snapshot = await fetchLayoutSnapshot(jobId, stamped, fontAssets);
  return compileDocument(
    { ...document, html: stamped, fontAssets },
    { ...options, ...(snapshot ? { layoutSnapshot: snapshot } : {}) },
  );
}
