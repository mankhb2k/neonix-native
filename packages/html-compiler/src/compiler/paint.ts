import { fail } from "./errors";
import { calcExpression, isPaintToken } from "./values";
import { splitTopLevel } from "./utils";
import type { Style } from "./model";

export type GradientStop = { offset: number; color: string };
export type GradientSpreadMethod = "pad" | "repeat";
export type Paint = string | { type: "linear-gradient"; angle?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] } | { type: "radial-gradient"; cx?: number; cy?: number; radius?: number; radiusX?: number; radiusY?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] } | { type: "conic-gradient"; from?: number; cx?: number; cy?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] };
type GradientBox = { width: number; height: number };

export function parseColor(value: string, property: string, currentColor = "#000000"): string {
  const v = value.trim().toLowerCase();
  if (v === "transparent" || (v === "none" && ["background", "background-color"].includes(property))) return "#00000000";
  if (v === "currentcolor") return parseColor(currentColor, "currentColor");
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const rgba = v.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+|100%|\d{1,2}%)\s*\)$/i);
  if (rgba) {
    const channels = [rgba[1], rgba[2], rgba[3]].map((channel) => Number(channel));
    const alphaToken = rgba[4]!;
    const alpha = alphaToken.endsWith("%") ? Number(alphaToken.slice(0, -1)) / 100 : Number(alphaToken);
    if (channels.some((channel) => channel < 0 || channel > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail("css-color-invalid", `${property} contains an invalid rgba color: ${value}`);
    const bytes = [...channels, Math.round(alpha * 255)].map((channel) => Math.round(channel).toString(16).padStart(2, "0"));
    return `#${bytes.join("")}`;
  }
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v)) fail("css-color-unsupported", `${property} must resolve to a hex color: ${value}`);
  return v;
}

function parseStopOffset(value: string | undefined, property: string, allowOutsideRange = false): number | undefined {
  if (value === undefined) return undefined;
  const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))(%)?$/);
  if (!match) fail("css-gradient-stop-invalid", `${property} has an invalid color-stop offset: ${value}`);
  const parsed = match as RegExpMatchArray;
  const offset = Number(parsed[1]) / (parsed[2] ? 100 : 1);
  if (!Number.isFinite(offset) || (!allowOutsideRange && (offset < 0 || offset > 1))) fail("css-gradient-stop-invalid", `${property} color-stop offset must be between 0% and 100%: ${value}`);
  return offset;
}

/**
 * CSS linear-gradient angles start at the bottom-to-top direction (0deg),
 * while the runtime paint convention starts on the positive X axis. Lower
 * CSS angles once at the HTML compiler boundary so every runtime backend
 * receives the same semantic gradient geometry.
 */
function cssLinearGradientAngleToRuntime(value: number): number {
  return value - 90;
}

function normalizeStops(parts: string[], property: string, currentColor = "#000000", repeating = false): GradientStop[] {
  if (parts.length < 2) fail("css-gradient-invalid", `${property} requires at least two color stops`);
  const stops = parts.map((part) => {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) fail("css-gradient-stop-invalid", `${property} contains an empty color stop`);
    return { color: parseColor(tokens[0], property, currentColor), offset: parseStopOffset(tokens[1], property, repeating) };
  });
  if (stops[0]!.offset === undefined) stops[0]!.offset = 0;
  if (stops[stops.length - 1]!.offset === undefined) stops[stops.length - 1]!.offset = 1;
  let index = 0;
  while (index < stops.length) {
    if (stops[index]!.offset !== undefined) { index += 1; continue; }
    const start = index - 1;
    while (index < stops.length && stops[index]!.offset === undefined) index += 1;
    const end = index;
    const from = stops[start]!.offset!; const to = stops[end]!.offset!;
    for (let i = start + 1; i < end; i += 1) stops[i]!.offset = from + ((to - from) * (i - start)) / (end - start);
  }
  for (let i = 1; i < stops.length; i += 1) if (stops[i]!.offset! < stops[i - 1]!.offset!) stops[i]!.offset = stops[i - 1]!.offset!;
  if (!repeating) return stops as GradientStop[];
  const start = stops[0]!.offset!;
  const end = stops[stops.length - 1]!.offset!;
  const period = end - start;
  if (!Number.isFinite(period) || period <= 0) fail("css-gradient-period-invalid", `${property} repeating gradient must define a positive period`);
  // Keep the period in normalized gradient space. Skia's repeat tile mode
  // repeats the interval between the first and last stop; rescaling that
  // interval to 0..1 would produce one non-repeating gradient per box.
  return stops.map((stop) => ({ ...stop, offset: stop.offset! - start }));
}

function parseGradient(value: string, property: string, currentColor = "#000000", box?: GradientBox): Exclude<Paint, string> {
  const match = value.trim().match(/^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/i);
  if (!match) fail("css-gradient-unsupported", `${property} supports linear-gradient(), radial-gradient(), conic-gradient() and repeating variants`);
  const parsed = match as RegExpMatchArray; const repeating = Boolean(parsed[1]); const kind = parsed[2]!.toLowerCase(); const args = splitTopLevel(parsed[3]!, ",");
  if (args.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const descriptor = args[0]!.trim(); const stopParts = isPaintToken(descriptor.split(/\s+/)[0] ?? "") ? args : args.slice(1);
  if (stopParts.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const stops = normalizeStops(stopParts, property, currentColor, repeating);
  const spreadMethod: GradientSpreadMethod | undefined = repeating ? "repeat" : undefined;
  if (kind === "linear") {
    let angle: number | undefined;
    const angleMatch = descriptor.match(/^(-?(?:\d+\.?\d*|\.\d+))deg$/i);
    if (angleMatch) angle = cssLinearGradientAngleToRuntime(Number(angleMatch[1]));
    else if (/^to\s+/i.test(descriptor)) {
      const direction = descriptor.toLowerCase().replace(/^to\s+/, ""); const angles: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 };
      angle = angles[direction]; if (angle === undefined) fail("css-gradient-direction-invalid", `${property} does not support direction: ${descriptor}`); angle = cssLinearGradientAngleToRuntime(angle);
    } else if (stopParts === args) angle = cssLinearGradientAngleToRuntime(180);
    else fail("css-gradient-direction-invalid", `${property} has an invalid linear direction: ${descriptor}`);
    return angle === undefined ? { type: "linear-gradient", ...(spreadMethod ? { spreadMethod } : {}), stops } : { type: "linear-gradient", angle, ...(spreadMethod ? { spreadMethod } : {}), stops };
  }
  const center = descriptor.match(/\bat\s+(-?(?:\d+\.?\d*|\.\d+))%\s+(-?(?:\d+\.?\d*|\.\d+))%/i);
  if (kind === "radial") {
    const cx = center ? Number(center[1]) / 100 : 0.5;
    const cy = center ? Number(center[2]) / 100 : 0.5;
    // CSS `circle` with no explicit size defaults to farthest-corner. The V2
    // radial primitive stores one scalar radius, normalized against the
    // smaller local axis, so lower the physical farthest-corner radius into
    // that scalar before the protocol is emitted.
    const circleRadius = /\bcircle\b/i.test(descriptor) && box
      ? Math.hypot(Math.max(cx * box.width, (1 - cx) * box.width), Math.max(cy * box.height, (1 - cy) * box.height)) / Math.min(box.width, box.height)
      : undefined;
    // CSS radial gradients default to an ellipse. The farthest-side ellipse
    // has independent horizontal/vertical radii (the farthest side on each
    // axis); farthest-corner then scales both by sqrt(2) to pass through the
    // farthest corner. Keep these normalized until V2 resolves each axis.
    const farthestSideX = Math.max(cx, 1 - cx);
    const farthestSideY = Math.max(cy, 1 - cy);
    const ellipseRadii = !/\bcircle\b/i.test(descriptor) && box
      ? { radiusX: farthestSideX * Math.SQRT2, radiusY: farthestSideY * Math.SQRT2 }
      : undefined;
    return { type: "radial-gradient", ...(center ? { cx, cy } : {}), ...(circleRadius === undefined ? {} : { radius: circleRadius }), ...(ellipseRadii ?? {}), ...(spreadMethod ? { spreadMethod } : {}), stops };
  }
  const from = descriptor.match(/\bfrom\s+(-?(?:\d+\.?\d*|\.\d+))deg/i);
  return { type: "conic-gradient", ...(from ? { from: Number(from[1]) } : {}), ...(center ? { cx: Number(center[1]) / 100, cy: Number(center[2]) / 100 } : {}), ...(spreadMethod ? { spreadMethod } : {}), stops };
}

export function parsePaintLayers(value: string, property: string, currentColor = "#000000", box?: GradientBox): Paint[] {
  return splitTopLevel(value, ",").map((layer) => /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(layer.trim()) ? parseGradient(layer, property, currentColor, box) : parseColor(layer, property, currentColor));
}

export function parseAspectRatio(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().toLowerCase() === "auto") return undefined;
  const parts = value.trim().split("/").map((part) => part.trim());
  if (parts.length > 2 || parts.some((part) => !/^(?:\d+\.?\d*|\.\d+)$/.test(part))) fail("css-aspect-ratio-invalid", `aspect-ratio must be a positive ratio: ${value}`);
  const numerator = Number(parts[0]);
  const denominator = parts.length === 2 ? Number(parts[1]) : 1;
  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio) || ratio <= 0) fail("css-aspect-ratio-invalid", `aspect-ratio must be a positive ratio: ${value}`);
  return ratio;
}

export type BorderStyle = "solid" | "none" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset";
export type BorderSide = { width: number; style: BorderStyle; color: string };
export type BorderEdges = { top: BorderSide; right: BorderSide; bottom: BorderSide; left: BorderSide };
export type CornerRadius = number | { topLeft: { rx: number; ry: number }; topRight: { rx: number; ry: number }; bottomRight: { rx: number; ry: number }; bottomLeft: { rx: number; ry: number } };

const BORDER_STYLES = ["solid", "none", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"] as const;
const BORDER_WIDTH_KEYWORDS: Record<string, number> = { thin: 1, medium: 3, thick: 5 };

function quadValues(value: string | undefined): string[] {
  return value === undefined ? [] : splitTopLevel(value.trim(), " ");
}

function expandQuad(values: string[], fallback: string): [string, string, string, string] {
  if (values.length === 0) return [fallback, fallback, fallback, fallback];
  if (values.length === 1) return [values[0]!, values[0]!, values[0]!, values[0]!];
  if (values.length === 2) return [values[0]!, values[1]!, values[0]!, values[1]!];
  if (values.length === 3) return [values[0]!, values[1]!, values[2]!, values[1]!];
  if (values.length === 4) return [values[0]!, values[1]!, values[2]!, values[3]!];
  fail("css-border-invalid", "Border longhands accept one to four values");
  return [fallback, fallback, fallback, fallback];
}

function parseBorderSideShorthand(value: string | undefined, property: string): { width?: string; style?: BorderStyle; color?: string } {
  if (value === undefined) return {};
  let width: string | undefined; let borderStyle: BorderStyle | undefined; let color: string | undefined;
  for (const token of splitTopLevel(value.trim(), " ")) {
    const lower = token.toLowerCase();
    if ((BORDER_STYLES as readonly string[]).includes(lower)) {
      if (borderStyle !== undefined) fail("css-border-invalid", `${property} contains more than one border style`);
      borderStyle = lower as BorderStyle;
    } else if (isPaintToken(token)) {
      if (color !== undefined) fail("css-border-invalid", `${property} contains more than one border color`);
      color = token;
    } else if (width === undefined) width = token;
    else fail("css-border-invalid", `Unsupported border token: ${token}`);
  }
  return { ...(width === undefined ? {} : { width }), ...(borderStyle === undefined ? {} : { style: borderStyle }), ...(color === undefined ? {} : { color }) };
}

function borderWidth(value: string, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const keyword = value.trim().toLowerCase();
  const resolved = BORDER_WIDTH_KEYWORDS[keyword] ?? calcExpression(value, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-border-width-invalid", `${property} must resolve to a non-negative length: ${value}`);
  return resolved;
}

export function parseBorderEdges(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): BorderEdges {
  const global = parseBorderSideShorthand(style.get("border"), "border");
  const widths = expandQuad(quadValues(style.get("border-width") ?? global.width), "0px");
  const styles = expandQuad(quadValues(style.get("border-style") ?? global.style), global.style ?? "none");
  const colors = expandQuad(quadValues(style.get("border-color") ?? global.color), global.color ?? "currentColor");
  const sideNames = ["top", "right", "bottom", "left"] as const;
  const result = {} as BorderEdges;
  sideNames.forEach((side, index) => {
    const sideShorthand = parseBorderSideShorthand(style.get(`border-${side}`), `border-${side}`);
    const widthValue = style.get(`border-${side}-width`) ?? sideShorthand.width ?? widths[index];
    const styleValue = (style.get(`border-${side}-style`) ?? sideShorthand.style ?? styles[index]).toLowerCase();
    if (!(BORDER_STYLES as readonly string[]).includes(styleValue)) fail("css-border-style-unsupported", `Unsupported border style: ${styleValue}`);
    const colorValue = style.get(`border-${side}-color`) ?? sideShorthand.color ?? colors[index];
    const width = borderWidth(widthValue, `border-${side}-width`, relative, fontSize, viewport);
    result[side] = { width: styleValue === "none" ? 0 : width, style: styleValue as BorderStyle, color: parseColor(colorValue, `border-${side}-color`, style.get("color") ?? "#000000") };
  });
  return result;
}

export type OutlineStyle = "solid" | "none";
export type Outline = { width: number; style: OutlineStyle; color: string; offset: number };

function parseOutlineShorthand(value: string | undefined): { width?: string; style?: OutlineStyle; color?: string } {
  if (value === undefined) return {};
  let width: string | undefined;
  let outlineStyle: OutlineStyle | undefined;
  let color: string | undefined;
  for (const token of splitTopLevel(value.trim(), " ")) {
    const lower = token.toLowerCase();
    if (["solid", "none"].includes(lower)) {
      if (outlineStyle !== undefined) fail("css-outline-invalid", "outline contains more than one style");
      outlineStyle = lower as OutlineStyle;
    } else if (isPaintToken(token)) {
      if (color !== undefined) fail("css-outline-invalid", "outline contains more than one color");
      color = token;
    } else if (width === undefined) width = token;
    else fail("css-outline-invalid", `Unsupported outline token: ${token}`);
  }
  return { ...(width === undefined ? {} : { width }), ...(outlineStyle === undefined ? {} : { style: outlineStyle }), ...(color === undefined ? {} : { color }) };
}

export function parseOutline(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): Outline {
  const shorthand = parseOutlineShorthand(style.get("outline"));
  const widthValue = style.get("outline-width") ?? shorthand.width ?? "medium";
  const styleValue = (style.get("outline-style") ?? shorthand.style ?? "none").toLowerCase();
  if (styleValue !== "solid" && styleValue !== "none") fail("css-outline-style-unsupported", `Unsupported outline style: ${styleValue}`);
  const offsetValue = style.get("outline-offset") ?? "0px";
  const offset = calcExpression(offsetValue, "outline-offset", relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(offset)) fail("css-outline-offset-invalid", `outline-offset must resolve to a finite length: ${offsetValue}`);
  return {
    width: borderWidth(widthValue, "outline-width", relative, fontSize, viewport),
    style: styleValue as OutlineStyle,
    color: parseColor(style.get("outline-color") ?? shorthand.color ?? "currentColor", "outline-color", style.get("color") ?? "#000000"),
    offset,
  };
}

type ShadowEffectBase = {
  id: string;
  type: "shadow";
  offset: { x: number; y: number };
  blur: number;
  color: string;
};
export type ShadowEffect =
  | (ShadowEffectBase & { source: "box"; spread: number; inset: boolean })
  | (ShadowEffectBase & { source: "alpha"; spread: 0; inset: false });

function shadowLength(value: string, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const resolved = calcExpression(value, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(resolved)) fail("css-shadow-length-invalid", `${property} must resolve to a finite length: ${value}`);
  return resolved;
}

function parseShadow(value: string, property: "text-shadow" | "box-shadow", index: number, relative: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): ShadowEffect {
  const tokens = splitTopLevel(value.trim(), " ");
  let inset = false;
  let color: string | undefined;
  const lengths: string[] = [];
  for (const token of tokens) {
    if (token.toLowerCase() === "inset") {
      if (inset) fail("css-shadow-invalid", `${property} contains more than one inset keyword`);
      inset = true;
    } else if (isPaintToken(token)) {
      if (color !== undefined) fail("css-shadow-invalid", `${property} contains more than one color`);
      color = token;
    } else lengths.push(token);
  }
  if (property === "text-shadow" && inset) fail("css-text-shadow-inset-unsupported", "text-shadow does not support inset");
  if (lengths.length < 2 || lengths.length > (property === "text-shadow" ? 3 : 4)) fail("css-shadow-invalid", `${property} expects two to four lengths`);
  const blur = lengths[2] === undefined ? 0 : shadowLength(lengths[2], `${property}.blur`, relative, fontSize, viewport);
  const spread = lengths[3] === undefined ? 0 : shadowLength(lengths[3], `${property}.spread`, relative, fontSize, viewport);
  if (blur < 0) fail("css-shadow-blur-invalid", `${property} blur must be non-negative`);
  const base: ShadowEffectBase = {
    id: `${property}:${index}`,
    type: "shadow",
    offset: { x: shadowLength(lengths[0]!, `${property}.offset-x`, relative, fontSize, viewport), y: shadowLength(lengths[1]!, `${property}.offset-y`, relative, fontSize, viewport) },
    blur,
    color: parseColor(color ?? currentColor, property, currentColor),
  };
  return property === "text-shadow"
    ? { ...base, source: "alpha", spread: 0, inset: false }
    : { ...base, source: "box", spread, inset };
}

export function parseShadows(style: Style, property: "text-shadow" | "box-shadow", relative: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): ShadowEffect[] {
  const raw = style.get(property)?.trim();
  if (!raw || raw.toLowerCase() === "none") return [];
  return splitTopLevel(raw, ",").map((value, index) => parseShadow(value, property, index, relative, fontSize, viewport, currentColor));
}

/** Legacy scalar view retained for callers that only need uniform borders. */
export function parseBorder(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): { color?: string; width?: number } {
  const edges = parseBorderEdges(style, relative, fontSize, viewport);
  const sides = Object.values(edges);
  if (sides.every((side) => side.style === "none" || side.width === 0)) return {};
  if (sides.every((side) => side.style === "solid" && side.width === sides[0]!.width && side.color === sides[0]!.color)) return { width: sides[0]!.width, color: sides[0]!.color };
  return {};
}

function radiusQuad(values: string[], property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): [number, number, number, number] {
  return expandQuad(values, "0px").map((value) => {
    const resolved = calcExpression(value, property, relative, fontSize, 16, viewport).value;
    if (!Number.isFinite(resolved) || resolved < 0) fail("css-border-radius-invalid", `Border radius must be non-negative: ${value}`);
    return resolved;
  }) as [number, number, number, number];
}

export function parseCornerRadii(style: Style, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): CornerRadius | undefined {
  const value = style.get("border-radius");
  if (value === undefined) return undefined;
  const parts = splitTopLevel(value, "/");
  if (parts.length > 2) fail("css-border-radius-invalid", `Invalid border-radius: ${value}`);
  const horizontal = radiusQuad(quadValues(parts[0]), "border-radius", width, fontSize, viewport);
  const vertical = radiusQuad(quadValues(parts[1] ?? parts[0]), "border-radius", height, fontSize, viewport);
  const scale = Math.min(1, width / Math.max(1e-9, horizontal[0]! + horizontal[1]!), width / Math.max(1e-9, horizontal[2]! + horizontal[3]!), height / Math.max(1e-9, vertical[0]! + vertical[3]!), height / Math.max(1e-9, vertical[1]! + vertical[2]!));
  const radii = { topLeft: { rx: horizontal[0]! * scale, ry: vertical[0]! * scale }, topRight: { rx: horizontal[1]! * scale, ry: vertical[1]! * scale }, bottomRight: { rx: horizontal[2]! * scale, ry: vertical[2]! * scale }, bottomLeft: { rx: horizontal[3]! * scale, ry: vertical[3]! * scale } };
  const all = Object.values(radii);
  if (all.every((corner) => corner.rx === corner.ry && corner.rx === all[0]!.rx)) return all[0]!.rx;
  return radii;
}

export function parseCornerRadius(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): number | undefined {
  const parsed = parseCornerRadii(style, relative, relative, fontSize, viewport);
  return typeof parsed === "number" ? parsed : undefined;
}
