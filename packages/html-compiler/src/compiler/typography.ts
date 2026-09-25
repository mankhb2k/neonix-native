import { fail } from "./errors";
import { calcExpression } from "./values";
import { parseColor } from "./paint";
import { splitTopLevel } from "./utils";
import type { HtmlCompilerFontAsset } from "../source";
import type { Style } from "./model";

export type HtmlCompilerTextAlign = "left" | "right" | "center" | "start" | "end" | "justify" | "match-parent" | "justify-all";
export type HtmlCompilerTextDirection = "ltr" | "rtl";
export type HtmlCompilerWritingMode = "horizontal-tb" | "vertical-rl" | "vertical-lr";
export type HtmlCompilerWhiteSpace = "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line" | "break-spaces";
export type HtmlCompilerTextSpacing = "normal" | { value: number; unit: "px" };
export type HtmlCompilerTextDecoration = Partial<Record<"underline" | "overline" | "lineThrough", { fill: string; strokeWidth?: { value: number; unit: "px" } }>>;
export type HtmlCompilerTextOverflow = "clip" | "ellipsis";
export type HtmlCompilerTextRendering = "auto" | "optimizeSpeed" | "geometricPrecision";

/** Normalize CSS text alignment into the Protocol V2 layout vocabulary. */
export function parseTextAlign(value: string | undefined): HtmlCompilerTextAlign {
  const normalized = (value ?? "start").trim().toLowerCase();
  if (["left", "right", "center", "start", "end", "justify", "match-parent", "justify-all"].includes(normalized)) return normalized as HtmlCompilerTextAlign;
  return fail("css-text-align-invalid", `text-align must be start, end, left, right, center, justify, match-parent or justify-all: ${value}`);
}

export function parseTextDirection(value: string | undefined): HtmlCompilerTextDirection {
  const normalized = (value ?? "ltr").trim().toLowerCase();
  if (normalized === "ltr" || normalized === "rtl") return normalized;
  return fail("css-direction-invalid", `direction must be ltr or rtl: ${value}`);
}

export function parseWritingMode(value: string | undefined): HtmlCompilerWritingMode {
  const normalized = (value ?? "horizontal-tb").trim().toLowerCase();
  if (["horizontal-tb", "vertical-rl", "vertical-lr"].includes(normalized)) return normalized as HtmlCompilerWritingMode;
  return fail("css-writing-mode-invalid", `writing-mode must be horizontal-tb, vertical-rl or vertical-lr: ${value}`);
}

export function parseTextDecoration(value: string | undefined, currentColor: string, containingWidth: number, fontSize: number, viewport: { width: number; height: number }): HtmlCompilerTextDecoration | undefined {
  const normalized = (value ?? "none").trim().toLowerCase();
  if (normalized === "none") return undefined;
  const lines = new Set<"underline" | "overline" | "lineThrough">();
  let color = currentColor;
  let strokeWidth: { value: number; unit: "px" } | undefined;
  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    if (token === "underline" || token === "overline" || token === "line-through") {
      lines.add(token === "line-through" ? "lineThrough" : token);
      continue;
    }
    if (token === "solid") continue;
    if (token === "double" || token === "dotted" || token === "dashed" || token === "wavy") {
      return fail("css-text-decoration-style-unsupported", `Only solid text-decoration is supported: ${token}`);
    }
    if (token === "currentcolor" || token === "transparent" || /^#[0-9a-f]{3,8}$/i.test(token)) {
      color = parseColor(token, "text-decoration-color", currentColor);
      continue;
    }
    if (token === "auto" || token === "from-font") continue;
    const resolved = calcExpression(token, "text-decoration-thickness", containingWidth, fontSize, 16, viewport);
    if (resolved.unit === "number" || !Number.isFinite(resolved.value) || resolved.value <= 0) fail("css-text-decoration-thickness-invalid", `text-decoration thickness must be a positive length: ${token}`);
    strokeWidth = { value: resolved.value, unit: "px" };
  }
  if (!lines.size) return fail("css-text-decoration-line-invalid", `text-decoration must include underline, overline or line-through: ${value}`);
  return Object.fromEntries([...lines].map((line) => [line, { fill: color, ...(strokeWidth ? { strokeWidth } : {}) }])) as HtmlCompilerTextDecoration;
}

export function parseWhiteSpace(value: string | undefined): HtmlCompilerWhiteSpace {
  const normalized = (value ?? "normal").trim().toLowerCase();
  if (["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"].includes(normalized)) return normalized as HtmlCompilerWhiteSpace;
  return fail("css-white-space-invalid", `white-space must be normal, nowrap, pre, pre-wrap, pre-line or break-spaces: ${value}`);
}

export function parseTextOverflow(value: string | undefined): HtmlCompilerTextOverflow {
  const normalized = (value ?? "clip").trim().toLowerCase();
  if (normalized === "clip" || normalized === "ellipsis") return normalized;
  return fail("css-text-overflow-invalid", `text-overflow must be clip or ellipsis: ${value}`);
}

export function parseTextRendering(value: string | undefined): HtmlCompilerTextRendering {
  const normalized = (value ?? "auto").trim().toLowerCase();
  if (normalized === "auto") return "auto";
  if (normalized === "optimizespeed") return "optimizeSpeed";
  if (normalized === "geometricprecision") return "geometricPrecision";
  return fail("css-text-rendering-invalid", `text-rendering must be auto, optimizeSpeed or geometricPrecision: ${value}`);
}

export function wrapForWhiteSpace(value: HtmlCompilerWhiteSpace): "none" | "word" {
  return value === "nowrap" || value === "pre" ? "none" : "word";
}

/** CSS word-break: only `normal`/`break-all` are supported (`keep-all`, which only affects CJK line breaking, is not). */
export function parseWordBreak(value: string | undefined): "normal" | "break-all" {
  const normalized = (value ?? "normal").trim().toLowerCase();
  if (normalized === "normal" || normalized === "break-all") return normalized;
  return fail("css-word-break-unsupported", `word-break must be normal or break-all: ${value}`);
}

/** CSS overflow-wrap/word-wrap (word-wrap is the legacy alias, still very common in hand-written CSS): only `normal`/`break-word` are supported (`anywhere`, which also changes min-content sizing, is not). */
export function parseOverflowWrap(value: string | undefined): "normal" | "break-word" {
  const normalized = (value ?? "normal").trim().toLowerCase();
  if (normalized === "normal" || normalized === "break-word") return normalized;
  return fail("css-overflow-wrap-unsupported", `overflow-wrap must be normal or break-word: ${value}`);
}

/**
 * `-webkit-line-clamp: N` only takes effect paired with `-webkit-box-orient:
 * vertical` (the legacy flexbox-based clamp syntax this authoring surface
 * accepts); `display: -webkit-box` itself is normalized to `block` in
 * css-parser.ts; -webkit-line-clamp/box-orient are ignored, not the trigger.
 */
export function parseLineClamp(style: Style): number | undefined {
  const raw = style.get("line-clamp");
  if (raw === undefined) return undefined;
  const boxOrient = (style.get("box-orient") ?? "horizontal").trim().toLowerCase();
  if (boxOrient !== "vertical") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "none") return undefined;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1) fail("css-line-clamp-invalid", `-webkit-line-clamp must be a positive integer or none: ${raw}`);
  return value;
}

/** CSS text-indent offsets only the first line of a block; negative values (hanging indent) are allowed. */
export function parseTextIndent(value: string | undefined, containingWidth: number, fontSize: number, viewport: { width: number; height: number }): number {
  if (value === undefined) return 0;
  const resolved = calcExpression(value.trim(), "text-indent", containingWidth, fontSize, 16, viewport);
  if (resolved.unit === "number" || !Number.isFinite(resolved.value)) fail("css-text-indent-invalid", `text-indent must resolve to a length: ${value}`);
  return resolved.value;
}

/** CSS font-variant: only `small-caps` is supported (the Protocol V2 span field this maps to is a boolean, not a full font-variant model). */
export function parseSmallCaps(value: string | undefined): boolean {
  return (value ?? "normal").trim().toLowerCase() === "small-caps";
}

export type HtmlCompilerBaselineShift = "baseline" | "subscript" | "superscript" | { value: number; unit: "px" };

/**
 * CSS vertical-align, resolved per inline span (via Protocol V2's SVG-style
 * `baseline-shift` field). Only `baseline`/`sub`/`super`/a length/percentage
 * are supported - `top`/`bottom`/`middle`/`text-top`/`text-bottom` align
 * within the line box's own metrics rather than shifting by a fixed amount
 * relative to the baseline, which this SVG-shaped field can't express, so
 * they fail loudly instead of rendering at the wrong position.
 */
export function parseVerticalAlign(value: string | undefined, containingWidth: number, fontSize: number, viewport: { width: number; height: number }): HtmlCompilerBaselineShift | undefined {
  const normalized = (value ?? "baseline").trim().toLowerCase();
  if (normalized === "baseline") return undefined;
  if (normalized === "sub") return "subscript";
  if (normalized === "super") return "superscript";
  if (["top", "bottom", "middle", "text-top", "text-bottom"].includes(normalized)) {
    fail("css-vertical-align-unsupported", `vertical-align only supports baseline, sub, super, or a length/percentage: ${value}`);
  }
  const resolved = calcExpression(normalized, "vertical-align", containingWidth, fontSize, 16, viewport);
  if (resolved.unit === "number" || !Number.isFinite(resolved.value)) fail("css-vertical-align-invalid", `vertical-align must resolve to a length: ${value}`);
  // CSS vertical-align: a positive length raises the box (shifts up). The
  // numeric baseline-shift channel this lowers into is signed the other way
  // (positive moves down, matching how glyph.y grows downward through the
  // rest of this coordinate system) - negate here, once, rather than at
  // every downstream consumer.
  return { value: -resolved.value, unit: "px" };
}

export function parseTextSpacing(value: string | undefined, property: "letter-spacing" | "word-spacing", containingWidth: number, fontSize: number, viewport: { width: number; height: number }): HtmlCompilerTextSpacing {
  const normalized = (value ?? "normal").trim().toLowerCase();
  if (normalized === "normal") return "normal";
  const resolved = calcExpression(normalized, property, containingWidth, fontSize, 16, viewport);
  if (!Number.isFinite(resolved.value)) fail("css-text-spacing-invalid", `${property} must resolve to a finite length: ${value}`);
  return { value: resolved.value, unit: "px" };
}

export function parseFontFamilies(value: string): string[] {
  const families = splitTopLevel(value, ",").map((family) => family.trim()).filter(Boolean).map((family) => {
    if ((family.startsWith("\"") && family.endsWith("\"")) || (family.startsWith("'") && family.endsWith("'"))) {
      return family.slice(1, -1).trim();
    }
    return family;
  });
  if (!families.length || families.some((family) => !family)) fail("css-font-family-invalid", `font-family must contain at least one family: ${value}`);
  return families;
}

export function parseFontWeight(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "normal") return 400;
  if (normalized === "bold") return 700;
  const weight = Number(normalized);
  if (!Number.isInteger(weight) || weight < 1 || weight > 1000) fail("css-font-weight-invalid", `font-weight must be normal, bold or an integer from 1 to 1000: ${value}`);
  return weight;
}

export function parseLineHeight(style: Style, fontSize: number, viewport: { width: number; height: number }): number {
  const value = (style.get("line-height") ?? "normal").trim().toLowerCase();
  if (value === "normal") return fontSize * 1.2;
  const resolved = calcExpression(value, "line-height", fontSize, fontSize, 16, viewport);
  const lineHeight = resolved.unit === "number" ? resolved.value * fontSize : resolved.value;
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) fail("css-line-height-invalid", `line-height must resolve to a positive value: ${value}`);
  return lineHeight;
}

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "emoji"]);
const STRETCHES = [
  "ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal",
  "semi-expanded", "expanded", "extra-expanded", "ultra-expanded",
] as const;

function selectWeight(assets: readonly HtmlCompilerFontAsset[], requested: number): HtmlCompilerFontAsset | undefined {
  const exact = assets.find((asset) => asset.weight === requested);
  if (exact) return exact;
  const ordered = [...assets].sort((left, right) => {
    const leftDelta = left.weight - requested;
    const rightDelta = right.weight - requested;
    const leftLower = leftDelta < 0;
    const rightLower = rightDelta < 0;
    // CSS font matching searches toward lighter weights first through 500,
    // and toward heavier weights first above 500.
    if (requested <= 500 && leftLower !== rightLower) return leftLower ? -1 : 1;
    if (requested > 500 && leftLower !== rightLower) return leftLower ? 1 : -1;
    return Math.abs(leftDelta) - Math.abs(rightDelta) || left.weight - right.weight;
  });
  return ordered[0];
}

function selectStretch(assets: readonly HtmlCompilerFontAsset[], requested: string): HtmlCompilerFontAsset[] {
  const exact = assets.filter((asset) => (asset.stretch ?? "normal") === requested);
  if (exact.length) return exact;
  const requestedIndex = STRETCHES.indexOf(requested as typeof STRETCHES[number]);
  return [...assets].sort((left, right) => {
    const leftIndex = STRETCHES.indexOf((left.stretch ?? "normal") as typeof STRETCHES[number]);
    const rightIndex = STRETCHES.indexOf((right.stretch ?? "normal") as typeof STRETCHES[number]);
    return Math.abs(leftIndex - requestedIndex) - Math.abs(rightIndex - requestedIndex);
  });
}

function selectStyle(assets: readonly HtmlCompilerFontAsset[], requested: string): HtmlCompilerFontAsset[] {
  const exact = assets.filter((asset) => asset.style === requested);
  if (exact.length) return exact;
  const fallback = requested === "oblique" ? ["italic", "normal"] : ["normal"];
  for (const style of fallback) {
    const matches = assets.filter((asset) => asset.style === style);
    if (matches.length) return matches;
  }
  return [];
}

export function resolveFontAssets(style: Style, assets: readonly HtmlCompilerFontAsset[]): { families: string[]; weight: number; style: "normal" | "italic" | "oblique"; stretch: typeof STRETCHES[number]; assets: HtmlCompilerFontAsset[] } {
  const families = parseFontFamilies(style.get("font-family") ?? "sans-serif");
  const weight = parseFontWeight(style.get("font-weight") ?? "400");
  const requestedStyle = (style.get("font-style") ?? "normal").trim().toLowerCase() as "normal" | "italic" | "oblique";
  if (!["normal", "italic", "oblique"].includes(requestedStyle)) fail("css-font-style-invalid", `Unsupported font-style: ${requestedStyle}`);
  const requestedStretch = (style.get("font-stretch") ?? "normal").trim().toLowerCase() as typeof STRETCHES[number];
  if (!STRETCHES.includes(requestedStretch)) fail("css-font-stretch-invalid", `Unsupported font-stretch: ${requestedStretch}`);
  const selected: HtmlCompilerFontAsset[] = [];
  for (const family of families) {
    if (GENERIC_FAMILIES.has(family.toLowerCase())) continue;
    const familyAssets = assets.filter((asset) => asset.family.toLowerCase() === family.toLowerCase());
    if (!familyAssets.length) continue;
    const styleAssets = selectStyle(familyAssets, requestedStyle);
    const stretchAssets = selectStretch(styleAssets, requestedStretch);
    const match = selectWeight(stretchAssets, weight);
    if (match) selected.push(match);
  }
  if (!selected.length) fail("css-font-asset-missing", `No font asset is available for ${families.join(", ")} at weight ${weight}`);
  return { families, weight, style: requestedStyle, stretch: requestedStretch, assets: selected };
}
