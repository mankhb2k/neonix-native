import { fail } from "./errors";
import { calcExpression } from "./values";
import { splitTopLevel } from "./utils";
import { parsePaintLayers, type Paint } from "./paint";
import type { Style } from "./model";

export type BackgroundPosition = { x: 0 | 0.5 | 1; y: 0 | 0.5 | 1 };
export type BackgroundSize =
  | { type: "auto" }
  | { type: "cover" }
  | { type: "contain" }
  | { type: "length"; width: number; height: number };
export type BackgroundRepeat = "repeat" | "repeat-x" | "repeat-y" | "no-repeat";
export type BackgroundBox = "border-box" | "padding-box" | "content-box";

export type BackgroundImage =
  | { type: "asset"; uri: string }
  | { type: "paint"; paint: Exclude<Paint, string> };

function listItem(value: string | undefined, index: number, fallback: string): string {
  const values = splitTopLevel(value ?? fallback, ",").map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) return fallback;
  return values[index] ?? values[values.length - 1]!;
}

function positionAxis(value: string, horizontal: boolean): 0 | 0.5 | 1 | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "center") return 0.5;
  if (horizontal && normalized === "left") return 0;
  if (horizontal && normalized === "right") return 1;
  if (!horizontal && normalized === "top") return 0;
  if (!horizontal && normalized === "bottom") return 1;
  const match = normalized.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/);
  if (!match) return undefined;
  const valueNumber = Number(match[1]);
  if (valueNumber === 0) return 0;
  if (valueNumber === 50) return 0.5;
  if (valueNumber === 100) return 1;
  return undefined;
}

export function parseBackgroundImages(
  style: Style,
  currentColor: string,
  box: { width: number; height: number },
): BackgroundImage[] {
  return parsePaintImages(style, "background-image", currentColor, box);
}

export function parseMaskImages(
  style: Style,
  currentColor: string,
  box: { width: number; height: number },
): BackgroundImage[] {
  return parsePaintImages(style, "mask-image", currentColor, box);
}

function parsePaintImages(
  style: Style,
  property: "background-image" | "mask-image",
  currentColor: string,
  box: { width: number; height: number },
): BackgroundImage[] {
  const raw = style.get(property);
  if (raw === undefined || raw.trim().toLowerCase() === "none") return [];
  return splitTopLevel(raw, ",").map((layer) => {
    const value = layer.trim();
    if (value.toLowerCase() === "none") return null;
    const url = value.match(/^url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)$/i);
    if (url) {
      const uri = (url[2] ?? url[3] ?? "").trim();
      if (!uri) fail(`css-${property}-invalid`, `${property} url() must contain an asset URI`);
      return { type: "asset" as const, uri };
    }
    if (/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value)) {
      const paints = parsePaintLayers(value, property, currentColor, box);
      if (paints.length !== 1 || typeof paints[0] === "string") fail(`css-${property}-invalid`, `Invalid gradient ${property}: ${value}`);
      return { type: "paint" as const, paint: paints[0] as Exclude<Paint, string> };
    }
    fail(`css-${property}-unsupported`, `${property} supports url() and gradients: ${value}`);
  }).filter((layer): layer is BackgroundImage => layer !== null);
}

export function parseBackgroundPosition(style: Style, index: number): BackgroundPosition {
  const raw = listItem(style.get("background-position"), index, "0% 0%");
  const values = raw.split(/\s+/).filter(Boolean);
  if (values.length === 1 && values[0] === "center") return { x: 0.5, y: 0.5 };
  if (values.length === 1) {
    const horizontal = positionAxis(values[0]!, true);
    const vertical = positionAxis(values[0]!, false);
    if (horizontal !== undefined && vertical === undefined) return { x: horizontal, y: 0.5 };
    if (vertical !== undefined && horizontal === undefined) return { x: 0.5, y: vertical };
  }
  if (values.length === 2) {
    let x = positionAxis(values[0]!, true);
    let y = positionAxis(values[1]!, false);
    if (x === undefined && positionAxis(values[0]!, false) !== undefined && positionAxis(values[1]!, true) !== undefined) {
      y = positionAxis(values[0]!, false);
      x = positionAxis(values[1]!, true);
    }
    if (x !== undefined && y !== undefined) return { x, y };
  }
  return fail("css-background-position-unsupported", `background-position supports keyword or 0%, 50%, 100% pairs: ${raw}`);
}

function sizeLength(value: string, property: string, relative: number): number {
  const resolved = calcExpression(value, property, relative, 16, 16, { width: 1920, height: 1080 }).value;
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-background-size-invalid", `${property} must resolve to a non-negative length: ${value}`);
  return resolved;
}

export function parseBackgroundSize(style: Style, index: number, relativeWidth: number, relativeHeight: number): BackgroundSize {
  const raw = listItem(style.get("background-size"), index, "auto").toLowerCase();
  if (raw === "auto") return { type: "auto" };
  if (raw === "cover" || raw === "contain") return { type: raw };
  const values = raw.split(/\s+/).filter(Boolean);
  if (values.length === 2 && values.every((value) => value !== "auto")) return { type: "length", width: sizeLength(values[0]!, "background-size", relativeWidth), height: sizeLength(values[1]!, "background-size", relativeHeight) };
  return fail("css-background-size-unsupported", `background-size supports auto, cover, contain or two explicit lengths: ${raw}`);
}

export function parseBackgroundRepeat(style: Style, index: number): BackgroundRepeat {
  const raw = listItem(style.get("background-repeat"), index, "repeat").toLowerCase();
  if (!["repeat", "repeat-x", "repeat-y", "no-repeat"].includes(raw)) fail("css-background-repeat-unsupported", `Unsupported background-repeat value: ${raw}`);
  return raw as BackgroundRepeat;
}

export function parseBackgroundBox(style: Style, property: "background-origin" | "background-clip", index: number): BackgroundBox {
  const raw = listItem(style.get(property), index, property === "background-origin" ? "padding-box" : "border-box").toLowerCase();
  if (!["border-box", "padding-box", "content-box"].includes(raw)) fail("css-background-box-unsupported", `${property} supports border-box, padding-box or content-box: ${raw}`);
  return raw as BackgroundBox;
}
