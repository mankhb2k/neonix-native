import { fail } from "./errors";
import { calcExpression, isPaintToken } from "./values";
import { splitTopLevel } from "./utils";
import type { Style } from "./model";

export type GradientStop = { offset: number; color: string };
export type Paint = string | { type: "linear-gradient"; angle?: number; stops: GradientStop[] } | { type: "radial-gradient"; cx?: number; cy?: number; radius?: number; stops: GradientStop[] } | { type: "conic-gradient"; from?: number; cx?: number; cy?: number; stops: GradientStop[] };
type GradientBox = { width: number; height: number };

export function parseColor(value: string, property: string, currentColor = "#000000"): string {
  const v = value.trim().toLowerCase();
  if (v === "transparent" || (v === "none" && ["background", "background-color"].includes(property))) return "#00000000";
  if (v === "currentcolor") return parseColor(currentColor, "currentColor");
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v)) fail("css-color-unsupported", `${property} must resolve to a hex color: ${value}`);
  return v;
}

function parseStopOffset(value: string | undefined, property: string): number | undefined {
  if (value === undefined) return undefined;
  const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))(%)?$/);
  if (!match) fail("css-gradient-stop-invalid", `${property} has an invalid color-stop offset: ${value}`);
  const parsed = match as RegExpMatchArray;
  const offset = Number(parsed[1]) / (parsed[2] ? 100 : 1);
  if (!Number.isFinite(offset) || offset < 0 || offset > 1) fail("css-gradient-stop-invalid", `${property} color-stop offset must be between 0% and 100%: ${value}`);
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

function normalizeStops(parts: string[], property: string, currentColor = "#000000"): GradientStop[] {
  if (parts.length < 2) fail("css-gradient-invalid", `${property} requires at least two color stops`);
  const stops = parts.map((part) => {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) fail("css-gradient-stop-invalid", `${property} contains an empty color stop`);
    return { color: parseColor(tokens[0], property, currentColor), offset: parseStopOffset(tokens[1], property) };
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
  return stops as GradientStop[];
}

function parseGradient(value: string, property: string, currentColor = "#000000", box?: GradientBox): Exclude<Paint, string> {
  const match = value.trim().match(/^(linear|radial|conic)-gradient\((.*)\)$/i);
  if (!match) fail("css-gradient-unsupported", `${property} supports linear-gradient(), radial-gradient() and conic-gradient()`);
  const parsed = match as RegExpMatchArray; const kind = parsed[1]!.toLowerCase(); const args = splitTopLevel(parsed[2]!, ",");
  if (args.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const descriptor = args[0]!.trim(); const stopParts = isPaintToken(descriptor.split(/\s+/)[0] ?? "") ? args : args.slice(1);
  if (stopParts.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const stops = normalizeStops(stopParts, property, currentColor);
  if (kind === "linear") {
    let angle: number | undefined;
    const angleMatch = descriptor.match(/^(-?(?:\d+\.?\d*|\.\d+))deg$/i);
    if (angleMatch) angle = cssLinearGradientAngleToRuntime(Number(angleMatch[1]));
    else if (/^to\s+/i.test(descriptor)) {
      const direction = descriptor.toLowerCase().replace(/^to\s+/, ""); const angles: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 };
      angle = angles[direction]; if (angle === undefined) fail("css-gradient-direction-invalid", `${property} does not support direction: ${descriptor}`); angle = cssLinearGradientAngleToRuntime(angle);
    } else if (stopParts === args) angle = cssLinearGradientAngleToRuntime(180);
    else fail("css-gradient-direction-invalid", `${property} has an invalid linear direction: ${descriptor}`);
    return angle === undefined ? { type: "linear-gradient", stops } : { type: "linear-gradient", angle, stops };
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
    return { type: "radial-gradient", ...(center ? { cx, cy } : {}), ...(circleRadius === undefined ? {} : { radius: circleRadius }), stops };
  }
  const from = descriptor.match(/\bfrom\s+(-?(?:\d+\.?\d*|\.\d+))deg/i);
  return { type: "conic-gradient", ...(from ? { from: Number(from[1]) } : {}), ...(center ? { cx: Number(center[1]) / 100, cy: Number(center[2]) / 100 } : {}), stops };
}

export function parsePaintLayers(value: string, property: string, currentColor = "#000000", box?: GradientBox): Paint[] {
  return splitTopLevel(value, ",").map((layer) => /^\w+-gradient\(/i.test(layer.trim()) ? parseGradient(layer, property, currentColor, box) : parseColor(layer, property, currentColor));
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

export function parseBorder(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): { color?: string; width?: number } {
  const shorthand = style.get("border"); let widthValue = style.get("border-width"); let styleValue = style.get("border-style"); let colorValue = style.get("border-color");
  let shorthandWidthSeen = false;
  if (shorthand) for (const token of shorthand.split(/\s+/).filter(Boolean)) { if (/^(solid|none)$/i.test(token)) styleValue = token.toLowerCase(); else if (isPaintToken(token)) colorValue = token; else if (widthValue === undefined || !shorthandWidthSeen) { if (widthValue === undefined) widthValue = token; shorthandWidthSeen = true; } else fail("css-border-invalid", `Unsupported border token: ${token}`); }
  if (styleValue !== undefined && !["solid", "none"].includes(styleValue.toLowerCase())) fail("css-border-style-unsupported", `Only solid and none borders are supported: ${styleValue}`);
  if (styleValue?.toLowerCase() === "none" || widthValue === undefined || widthValue === "0" || widthValue === "0px") return {};
  const width = calcExpression(widthValue, "border-width", relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(width) || width <= 0) fail("css-border-width-invalid", `Border width must be positive: ${widthValue}`);
  return { width, color: parseColor(colorValue ?? "currentColor", "border-color", style.get("color") ?? "#000000") };
}

export function parseCornerRadius(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): number | undefined {
  const value = style.get("border-radius"); if (value === undefined) return undefined;
  const parts = splitTopLevel(value, "/"); const horizontal = parts[0]!.split(/\s+/).filter(Boolean); const vertical = (parts[1] ?? parts[0]!).split(/\s+/).filter(Boolean);
  if (horizontal.length !== 1 || vertical.length !== 1 || horizontal[0] !== vertical[0]) fail("css-border-radius-unsupported", "Phase 4 supports one uniform border-radius value");
  const radius = calcExpression(horizontal[0]!, "border-radius", relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(radius) || radius < 0) fail("css-border-radius-invalid", `Border radius must be non-negative: ${value}`);
  return radius;
}
