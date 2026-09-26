/**
 * Tooling for measuring layout geometry from a real browser, to compare
 * against (and, in a later step, feed into) html-compiler's own flex/grid/
 * geometry resolution. See node-box.ts's doc comment for the seam this
 * feeds; this file only produces measurements, it never consumes them.
 *
 * html-compiler itself must never depend on or execute in a browser (see
 * scripts/validate-arch-deps.ts's "core -> browser" rule) - everything here
 * is either pure string manipulation that runs at compile time (stampNodeIds)
 * or plain DOM source that some OTHER package's runner (a Playwright page,
 * an iframe) executes, never html-compiler itself.
 */

/**
 * The attribute `stampNodeIds()` writes onto every real opening tag in a
 * fixture's HTML, and `runLayoutProbe()` reads back out of the live DOM.
 * Using an explicit, embedded key like this - rather than trying to
 * reproduce html-compiler's own node traversal/id scheme (`atomicId`/
 * `structuralPath`) independently on the browser side - is what keeps this
 * immune to a real browser's HTML5 parser silently reshaping the tree
 * (implicit <tbody>, auto-closed tags, etc.): every element that carries
 * this attribute in the SOURCE TEXT keeps it, whatever else either parser
 * does around it.
 */
export const LAYOUT_PROBE_ID_ATTRIBUTE = "data-neonix-probe-id";

// Matches, in order of priority: an HTML comment, a doctype, a whole
// <style>/<script> block (contents skipped untouched - CSS/JS can contain
// '<'/'>' that isn't a tag), a closing tag, or a real opening/self-closing
// tag (captured, so the replacer can tell it apart from the other
// alternatives it must leave untouched).
const OPENING_TAG_PATTERN = /<!--[\s\S]*?-->|<!doctype[^>]*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<script\b[^>]*>[\s\S]*?<\/script\s*>|<\/[a-zA-Z][\w-]*\s*>|<([a-zA-Z][\w-]*)((?:\s[^<>]*)?)(\/?)>/gi;

/**
 * Stamps every real opening tag in `html` (skipping comments, doctype, and
 * <style>/<script> block contents) with a sequential
 * `data-neonix-probe-id="n0"`, `"n1"`, ... attribute, in source order. Pure
 * string manipulation (same approach as `ensureBrowserPreviewBodyStyle` in
 * browser-preview-style.ts) - no HTML parsing, so the output is
 * byte-identical to the input except for the inserted attributes,
 * guaranteeing a real browser renders it exactly the same as the un-stamped
 * source would have.
 *
 * Known, accepted limitation: an attribute value containing a literal `>`
 * (e.g. `title="a > b"`) would confuse the tag boundary. None of
 * html-compiler's fixtures do this today.
 */
export function stampNodeIds(html: string): string {
  let counter = 0;
  return html.replace(OPENING_TAG_PATTERN, (match, tag: string | undefined, attrs: string | undefined, selfClose: string | undefined) => {
    if (tag === undefined) return match;
    return `<${tag}${attrs ?? ""} ${LAYOUT_PROBE_ID_ATTRIBUTE}="n${counter++}"${selfClose ?? ""}>`;
  });
}

export type LayoutProbeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** [top, right, bottom, left], px - always computed-style-resolved, never a percentage. */
  padding: [top: number, right: number, bottom: number, left: number];
  /** [top, right, bottom, left], px. */
  border: [top: number, right: number, bottom: number, left: number];
};

export type LayoutProbeResult = Record<string, LayoutProbeBox>;

/**
 * A snapshot ready to feed into `compileDocument(doc, { layoutSnapshot })` -
 * exactly the shape `runLayoutProbe()` returns. Keying is the only contract:
 * `resolveNodeBox()` looks up a node by its own `LAYOUT_PROBE_ID_ATTRIBUTE`
 * value, nothing else.
 */
export type LayoutSnapshot = LayoutProbeResult;

/**
 * Plain DOM script - no Playwright/browser-automation import, and no
 * reference to anything else in this module (a runner passes this function
 * by reference into whatever re-evaluates it in a real page - e.g.
 * Playwright's `page.evaluate(runLayoutProbe, LAYOUT_PROBE_ID_ATTRIBUTE)` -
 * which serializes it via `Function.prototype.toString()`, so it cannot
 * close over anything from this file's module scope). html-compiler itself
 * never executes it.
 *
 * Excludes any element with a non-`none` computed `transform` on itself OR
 * any ancestor. This is deliberate, not an oversight: `getBoundingClientRect`
 * always returns POST-transform (visually rotated/scaled/translated) page
 * coordinates, while html-compiler's own layout resolves a node's box
 * BEFORE its CSS transform is applied (the runtime composites `transform`
 * as a separate track on top of layout position - see transform.ts/
 * animation.ts). Feeding a post-transform measurement into a pre-transform
 * field would apply the transform twice. There is no cheap way to undo an
 * arbitrary ancestor transform chain from inside the measured rect alone,
 * so elements under one are simply left out of the snapshot instead -
 * `resolveNodeBox()` then falls back to native computation for them exactly
 * as it does for any other id absent from the snapshot.
 */
export function runLayoutProbe(idAttribute: string): LayoutProbeResult {
  const result: LayoutProbeResult = {};
  const toPx = (value: string): number => Number.parseFloat(value) || 0;
  const underTransform = (element: Element): boolean => {
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).transform !== "none") return true;
    }
    return false;
  };
  document.querySelectorAll(`[${idAttribute}]`).forEach((element) => {
    const id = element.getAttribute(idAttribute);
    if (!id || underTransform(element)) return;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    result[id] = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      padding: [toPx(style.paddingTop), toPx(style.paddingRight), toPx(style.paddingBottom), toPx(style.paddingLeft)],
      border: [toPx(style.borderTopWidth), toPx(style.borderRightWidth), toPx(style.borderBottomWidth), toPx(style.borderLeftWidth)],
    };
  });
  return result;
}
