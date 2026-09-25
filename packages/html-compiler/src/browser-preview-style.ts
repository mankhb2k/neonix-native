import { parseNeonixDocument } from "./compiler/document";

const BROWSER_PREVIEW_RESET_PROPERTIES = ["margin", "width", "height", "overflow"] as const;

const STYLE_TAG_PATTERN = /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
const RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;

/**
 * Best-effort check for whether html/body already has its own box-model
 * reset. This is a plain regex scan over top-level rules (it does not look
 * inside @media/@supports blocks), which is an intentional trade-off: it
 * only needs to avoid clobbering an explicit top-level override, not parse
 * CSS exhaustively. The compiler ignores html/body's own CSS entirely (the
 * canvas is always sized from composition metadata), so both a false
 * positive and a false negative here only ever affect a real browser
 * opening the raw file - never the compiled Neonix output.
 */
function declaredResetProperties(css: string): Set<string> {
  const declared = new Set<string>();
  for (const [, selectorText, declarationText] of css.matchAll(RULE_PATTERN)) {
    const targetsHtmlOrBody = selectorText
      .split(",")
      .map((selector) => selector.trim().toLowerCase())
      .some((selector) => selector === "html" || selector === "body");
    if (!targetsHtmlOrBody) continue;
    for (const property of BROWSER_PREVIEW_RESET_PROPERTIES) {
      if (new RegExp(`(?:^|[;{])\\s*${property}\\s*:`, "i").test(`;${declarationText}`)) declared.add(property);
    }
  }
  return declared;
}

/**
 * Adds a browser-preview-only html/body reset to a neonix-document when none
 * of margin/width/height/overflow are already declared for html/body -
 * purely so opening the raw HTML file in a real browser matches what Neonix
 * renders. It is never required: the compiler sizes the canvas from the
 * neonix-document composition metadata alone and ignores html/body CSS, so
 * this has zero effect on the compiled output either way.
 *
 * width/height are read from *this document's own* composition metadata and
 * injected as exact pixels (e.g. `1080px`), not `100vw`/`100vh`/`100%` - a
 * real browser resolves viewport/percentage units against its own window
 * size, which has nothing to do with the authored composition, so either
 * would only coincidentally match and generally would not.
 */
export function ensureBrowserPreviewBodyStyle(html: string): { html: string; injected: boolean } {
  let width: number;
  let height: number;
  try {
    ({ width, height } = parseNeonixDocument({ html }).composition);
  } catch {
    // Metadata is missing/invalid; leave html untouched and let the normal
    // compile step (called right after this) report that error properly.
    return { html, injected: false };
  }

  const styleBlocks = [...html.matchAll(STYLE_TAG_PATTERN)];
  const combinedCss = styleBlocks.map(([, , content]) => content).join("\n");
  const declared = declaredResetProperties(combinedCss);
  if (BROWSER_PREVIEW_RESET_PROPERTIES.every((property) => declared.has(property))) {
    return { html, injected: false };
  }

  const resetRule = `html, body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
      }`;

  const firstStyle = styleBlocks[0];
  if (firstStyle) {
    const insertAt = (firstStyle.index ?? 0) + firstStyle[0].indexOf(">") + 1;
    return {
      html: `${html.slice(0, insertAt)}\n      ${resetRule}\n${html.slice(insertAt)}`,
      injected: true,
    };
  }
  const headCloseIndex = html.search(/<\/head\s*>/i);
  if (headCloseIndex === -1) return { html, injected: false };
  return {
    html: `${html.slice(0, headCloseIndex)}    <style data-neonix-bundle>\n      ${resetRule}\n    </style>\n${html.slice(headCloseIndex)}`,
    injected: true,
  };
}
