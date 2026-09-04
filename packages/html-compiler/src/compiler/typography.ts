import { fail } from "./errors";
import { calcExpression } from "./values";
import { splitTopLevel } from "./utils";
import type { HtmlCompilerFontAsset } from "../source";
import type { Style } from "./model";

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
