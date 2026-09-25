/**
 * Real text-height measurement for `height:auto` boxes, as an optional,
 * additive alternative to `pipeline/compile.ts`'s own character-count
 * heuristic (`estimateTextIntrinsicHeight`). See that function's own comment
 * for why the heuristic exists and its accuracy limits.
 *
 * `prepareHtmlTextSizing()` runs ahead of the (synchronous) compile, real
 * HarfBuzz-shapes every eligible text-bearing leaf using the exact same
 * shaping path Preview/export use (`@motionvideo/motion-runtime`), and
 * returns a lookup that `layout()` consults by cache key instead of falling
 * through to the heuristic. A cache miss (or omitting `textSizing`
 * entirely) is always safe - it just means "no improvement for this node",
 * never a wrong compile - so the eligibility rule here can stay
 * conservative without any correctness risk.
 *
 * Scope of this first pass: only a text-bearing LEAF node (no element
 * children) with an explicit absolute-length `width` (px, not `auto` or a
 * `%`) qualifies, because that is the only case where the wrapping width is
 * knowable without first running the real (recursive, layout-order-
 * dependent) layout pass. A `height:auto` block CONTAINER whose text is
 * nested a level down, or a node whose own width is `auto`/`%`, still uses
 * the heuristic - tracked as a follow-up in debt-technical.md rather than
 * silently guessed at here.
 */
import type { HtmlCompilerFontAsset, HtmlTextSizingLookup } from "../source";
import type { Node, Style } from "./model";
import { parseHtml } from "./html/parser";
import { withoutNeonixManifest } from "./html/manifest";
import { collectStyles } from "./document";
import { parseAnimationStyles, parseRules } from "./css/parser";
import { computed } from "./css/cascade";
import { edges, number, resolveVar } from "./css/values";
import { parseBorderEdges } from "./paint";
import { parseLineHeight, parseWhiteSpace, resolveFontAssets, wrapForWhiteSpace } from "./css/typography";
import { isTextFlowNode, collectTextContentWithBreaks, normalizeTextContent } from "./lowering/dispatcher";
import {
  measureVisualRuntimeText,
  type VisualRuntimeText,
  type VisualRuntimeTextFontResolver,
  type VisualRuntimeTextFontSource,
  type VisualRuntimeTextShaperLoader,
} from "@motionvideo/motion-runtime";

/** The padding/border/box-sizing/declared-width resolution `estimateTextIntrinsicHeight` (compile.ts) also uses - kept here as the single source of truth so the real-measurement pre-pass and the heuristic fallback always agree on what "the content width to wrap against" means. */
export function resolveTextContentWidth(style: Style, containingWidth: number, fontSize: number, viewport: { width: number; height: number }): number {
  const padding = edges(style, "padding", containingWidth, fontSize, 16, viewport);
  const border = parseBorderEdges(style, containingWidth, fontSize, viewport);
  const horizontalDecorations = padding[1] + padding[3] + border.right.width + border.left.width;
  const boxSizing = (style.get("box-sizing") ?? "content-box").trim().toLowerCase();
  const declaredWidth = number(style, "width", containingWidth, fontSize, 16, viewport);
  return Number.isFinite(declaredWidth)
    ? Math.max(1, boxSizing === "border-box" ? declaredWidth - horizontalDecorations : declaredWidth)
    : Math.max(1, containingWidth - horizontalDecorations);
}

/**
 * A cache key for one (text, effective font, wrap width) combination. Only
 * needs to be a PURE function of these - the two callers (the async
 * pre-pass, and `layout()`'s synchronous lookup) run against independently
 * parsed DOM/style trees, so there is no Node-object identity to key on. A
 * mismatch here only costs a cache miss (safe fallback to the heuristic),
 * never a wrong result, so exact-string-equality on resolved CSS values is
 * an intentionally simple, conservative choice.
 */
export function textSizingCacheKey(text: string, style: Style, fontSize: number, contentWidth: number): string {
  const lineHeight = style.get("line-height") ?? "normal";
  const letterSpacing = style.get("letter-spacing") ?? "normal";
  const wordSpacing = style.get("word-spacing") ?? "normal";
  const whiteSpace = style.get("white-space") ?? "normal";
  const fontFamily = style.get("font-family") ?? "sans-serif";
  const fontWeight = style.get("font-weight") ?? "400";
  const fontStyle = style.get("font-style") ?? "normal";
  const fontStretch = style.get("font-stretch") ?? "normal";
  return [
    text, fontFamily, fontWeight, fontStyle, fontStretch,
    fontSize, lineHeight, letterSpacing, wordSpacing, whiteSpace,
    Math.round(contentWidth * 100) / 100,
  ].join("\u0001");
}

export type PrepareHtmlTextSizingOptions = {
  fontAssets: readonly HtmlCompilerFontAsset[];
  /** Fetches one font asset's real bytes. Returning null skips that font (falls back to the heuristic for any text needing it) rather than failing the whole pre-pass. */
  resolveFontBytes: (asset: HtmlCompilerFontAsset) => Promise<Uint8Array | ArrayBuffer | null>;
  loadHarfBuzz: VisualRuntimeTextShaperLoader;
  viewport?: { width: number; height: number };
};

function fontSource(asset: HtmlCompilerFontAsset): VisualRuntimeTextFontSource {
  return { assetId: asset.id, uri: asset.uri, integrity: asset.integrity };
}

/**
 * Walks the document once (its own parse + cascade, independent of the real
 * compile) and real-measures every eligible text-bearing leaf's wrapped
 * height. Returns an empty map (never throws) on any node it can't confidently
 * resolve - html-compiler's own compile pass remains the single source of
 * truth for validation errors; this pre-pass only ever improves accuracy for
 * the nodes it does resolve.
 */
export async function prepareHtmlTextSizing(html: string, css: string, options: PrepareHtmlTextSizingOptions): Promise<HtmlTextSizingLookup> {
  const lookup = new Map<string, { height: number }>();
  // `html` may be a single-file document with its CSS still inline in
  // <style> tags (the HtmlDocumentInput/MCP shape) or already-separated
  // HtmlCssSource-style markup with no <style> tags at all - extracting
  // handles both the same way `parseNeonixDocument` does for the real
  // compile, so cascade resolution here matches it exactly.
  const extracted = collectStyles(withoutNeonixManifest(html));
  const root = parseHtml(extracted.html);
  const parsedStylesheet = parseAnimationStyles([extracted.css, css].filter(Boolean).join("\n"));
  const rules = parseRules(parsedStylesheet.css);
  const viewport = options.viewport ?? { width: 1920, height: 1080 };

  const fontBytesCache = new Map<string, Promise<Uint8Array | ArrayBuffer | null>>();
  const resolveFont: VisualRuntimeTextFontResolver = async (source) => {
    const cached = fontBytesCache.get(source.assetId);
    if (cached) return cached;
    const asset = options.fontAssets.find((candidate) => candidate.id === source.assetId);
    const promise = asset ? options.resolveFontBytes(asset) : Promise.resolve(null);
    fontBytesCache.set(source.assetId, promise);
    return promise;
  };

  const pending: Promise<void>[] = [];

  function visit(node: Node, parentStyle: Style): void {
    let style: Style;
    try {
      style = computed(node, rules, parentStyle);
      const scopedVars = new Map<string, string>();
      for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value);
      for (const [property, value] of [...style]) {
        const resolved = resolveVar(value, scopedVars, new Set());
        style.set(property, resolved);
        if (property.startsWith("--")) scopedVars.set(property, resolved);
      }
    } catch {
      // Cascade/var-resolution failures are real compile errors - let the
      // actual compile surface them. This pre-pass just skips the subtree.
      return;
    }

    const hasElementChildren = node.children.length > 0;
    const heightAuto = !style.get("height") || style.get("height")!.trim().toLowerCase() === "auto";
    const widthValue = style.get("width")?.trim().toLowerCase();
    const widthIsAbsoluteLength = widthValue !== undefined && /^-?(?:\d+\.?\d*|\.\d+)px$/.test(widthValue);

    if (!hasElementChildren && heightAuto && widthIsAbsoluteLength && isTextFlowNode(node)) {
      const text = normalizeTextContent(collectTextContentWithBreaks(node), true).text;
      if (text) {
        pending.push((async () => {
          try {
            const fontSizeValue = number(style, "font-size", viewport.width, 16, 16, viewport) || 16;
            const containingWidth = Number.parseFloat(widthValue!);
            const contentWidth = resolveTextContentWidth(style, containingWidth, fontSizeValue, viewport);
            const whiteSpace = parseWhiteSpace(style.get("white-space"));
            const wrap = wrapForWhiteSpace(whiteSpace);
            const font = resolveFontAssets(style, options.fontAssets);
            const [primaryAsset, ...fallbackAssets] = font.assets;
            if (!primaryAsset) return;
            const lineHeight = parseLineHeight(style, fontSizeValue, viewport);
            const probe: VisualRuntimeText = {
              kind: "text",
              text,
              fontAssetId: primaryAsset.id,
              fontUri: primaryAsset.uri,
              fontIntegrity: primaryAsset.integrity,
              fontFallbacks: fallbackAssets.map(fontSource),
              fontSize: fontSizeValue,
              lineHeight,
              letterSpacing: 0,
              align: "left",
              verticalAlign: "top",
              wrap,
              overflow: "visible",
              direction: "ltr",
              language: "en",
              fill: "#000000",
              width: contentWidth,
              height: lineHeight,
              contentWidth,
            };
            const measured = await measureVisualRuntimeText(probe, resolveFont, options.loadHarfBuzz);
            if (measured) lookup.set(textSizingCacheKey(text, style, fontSizeValue, contentWidth), { height: measured.height });
          } catch {
            // Any measurement failure (missing font bytes, shaper load
            // failure, ...) just leaves this node on the heuristic.
          }
        })());
      }
    }

    for (const child of node.children) visit(child, style);
  }

  const rootVars = new Map<string, string>();
  for (const rule of rules) if (rule.selectors.some((selector) => selector.trim() === ":root")) for (const declaration of rule.declarations) if (declaration.property.startsWith("--")) rootVars.set(declaration.property, declaration.value);
  root.children.forEach((child) => visit(child, rootVars));

  await Promise.all(pending);
  return lookup;
}
