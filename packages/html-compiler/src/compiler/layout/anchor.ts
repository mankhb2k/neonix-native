import { fail } from "../errors";
import type { Style } from "../model";
import type { LayoutRect } from "./layout-ir";

export type CssAnchorBox = LayoutRect;

const ANCHOR_NAME = /^--[A-Za-z_][A-Za-z0-9_-]*$/;
const ANCHOR_PROPERTIES = ["left", "right", "top", "bottom", "width", "height"] as const;
type AnchorProperty = typeof ANCHOR_PROPERTIES[number];
type AnchorEdge = "top" | "right" | "bottom" | "left" | "center";
type AnchorSize = "width" | "height" | "inline" | "block";

export function parseAnchorNames(style: Style): string[] {
  const raw = style.get("anchor-name")?.trim() ?? "none";
  if (raw.toLowerCase() === "none") return [];
  const names = raw.split(/\s+/).filter(Boolean);
  if (names.length === 0 || names.some((name) => !ANCHOR_NAME.test(name))) {
    return fail("css-anchor-name-invalid", `anchor-name expects one or more dashed-ident names: ${raw}`);
  }
  return names;
}

function positionAnchorName(style: Style): string | undefined {
  const raw = style.get("position-anchor")?.trim() ?? "none";
  if (raw.toLowerCase() === "none") return undefined;
  if (!ANCHOR_NAME.test(raw)) fail("css-position-anchor-invalid", `position-anchor expects one dashed-ident name: ${raw}`);
  return raw;
}

function parseAnchorFunction(value: string, style: Style, property: AnchorProperty): { name: string; edge: AnchorEdge; fallback?: string } | undefined {
  const match = value.trim().match(/^anchor\(\s*(?:(--[A-Za-z_][A-Za-z0-9_-]*)\s+)?(top|right|bottom|left|center)(?:\s*,\s*(.+))?\s*\)$/i);
  if (!match) return undefined;
  const name = match[1] ?? positionAnchorName(style);
  if (!name) fail("css-anchor-reference-missing", `${property} anchor() requires a named anchor or position-anchor`);
  return { name, edge: match[2]!.toLowerCase() as AnchorEdge, fallback: match[3]?.trim() };
}

function parseAnchorSizeFunction(value: string, style: Style, property: AnchorProperty): { name: string; size: AnchorSize; fallback?: string } | undefined {
  const match = value.trim().match(/^anchor-size\(\s*(?:(--[A-Za-z_][A-Za-z0-9_-]*)\s+)?(width|height|inline|block)(?:\s*,\s*(.+))?\s*\)$/i);
  if (!match) return undefined;
  const name = match[1] ?? positionAnchorName(style);
  if (!name) fail("css-anchor-reference-missing", `${property} anchor-size() requires a named anchor or position-anchor`);
  return { name, size: match[2]!.toLowerCase() as AnchorSize, fallback: match[3]?.trim() };
}

function fallbackValue(raw: string | undefined, property: string): number {
  if (!raw) return fail("css-anchor-reference-missing", `${property} references an unavailable anchor and has no fallback`);
  const value = Number(raw.trim().replace(/px$/i, ""));
  if (!Number.isFinite(value)) return fail("css-anchor-fallback-invalid", `${property} anchor fallback must be a finite px length: ${raw}`);
  return value;
}

function anchorCoordinate(box: CssAnchorBox, edge: AnchorEdge, horizontal: boolean): number {
  if (horizontal) {
    if (edge === "left") return box.x;
    if (edge === "right") return box.x + box.width;
    return box.x + box.width / 2;
  }
  if (edge === "top") return box.y;
  if (edge === "bottom") return box.y + box.height;
  return box.y + box.height / 2;
}

function resolveAnchorLength(value: string, property: AnchorProperty, style: Style, containingBlock: CssAnchorBox, anchors: ReadonlyMap<string, CssAnchorBox>): number | undefined {
  const anchor = parseAnchorFunction(value, style, property);
  if (anchor) {
    const box = anchors.get(anchor.name);
    if (!box) return fallbackValue(anchor.fallback, property);
    const coordinate = anchorCoordinate(box, anchor.edge, property === "left" || property === "right");
    if (property === "left") return coordinate - containingBlock.x;
    if (property === "right") return containingBlock.x + containingBlock.width - coordinate;
    if (property === "top") return coordinate - containingBlock.y;
    if (property === "bottom") return containingBlock.y + containingBlock.height - coordinate;
    return fail("css-anchor-position-invalid", `${property} cannot use anchor() as a length`);
  }
  const size = parseAnchorSizeFunction(value, style, property);
  if (!size) return undefined;
  const box = anchors.get(size.name);
  if (!box) return fallbackValue(size.fallback, property);
  if (property === "width" && size.size !== "width" && size.size !== "inline") fail("css-anchor-size-invalid", `width requires anchor-size(width|inline): ${value}`);
  if (property === "height" && size.size !== "height" && size.size !== "block") fail("css-anchor-size-invalid", `height requires anchor-size(height|block): ${value}`);
  return size.size === "width" || size.size === "inline" ? box.width : box.height;
}

/** Resolve static CSS Anchor Positioning before the renderer-independent V2 lowering. */
export function resolveAnchorStyle(style: Style, containingBlock: CssAnchorBox, anchors: ReadonlyMap<string, CssAnchorBox>): Style {
  const hasAnchorFunction = ANCHOR_PROPERTIES.some((property) => style.get(property)?.includes("anchor(") || style.get(property)?.includes("anchor-size("));
  if (!hasAnchorFunction) return style;
  if ((style.get("position") ?? "static").trim().toLowerCase() !== "absolute") return fail("css-anchor-position-invalid", "anchor() and anchor-size() currently require position:absolute");
  const resolved = new Map(style);
  for (const property of ANCHOR_PROPERTIES) {
    const raw = style.get(property);
    if (!raw || (!raw.includes("anchor(") && !raw.includes("anchor-size("))) continue;
    if (/^calc\(/i.test(raw.trim())) return fail("css-anchor-expression-unsupported", `${property} does not support calc() around anchor(); use a standalone anchor value`);
    const value = resolveAnchorLength(raw, property, style, containingBlock, anchors);
    if (value !== undefined) resolved.set(property, `${value}px`);
  }
  return resolved;
}
