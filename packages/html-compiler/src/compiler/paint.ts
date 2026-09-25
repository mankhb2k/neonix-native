import { fail } from "./errors";
import { calcExpression, isPaintToken, NAMED_COLORS } from "./values";
import { splitTopLevel } from "./utils";
import type { Style } from "./model";

export type GradientStop = { offset: number; color: string };
export type GradientSpreadMethod = "pad" | "repeat";
export type Paint = string | { type: "linear-gradient"; angle?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] } | { type: "radial-gradient"; cx?: number; cy?: number; radius?: number; radiusX?: number; radiusY?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] } | { type: "conic-gradient"; from?: number; cx?: number; cy?: number; spreadMethod?: GradientSpreadMethod; stops: GradientStop[] };
type GradientBox = { width: number; height: number };

/**
 * Every `<color>` syntax parseColor() actually accepts, for get_capabilities
 * to surface to an authoring AI directly (this is the single source of
 * truth both parseColor() and get_capabilities read from, so the two can
 * never drift apart the way the hand-written docs a color-format bug report
 * pointed at had).
 */
export const SUPPORTED_COLOR_FORMATS = [
  { syntax: "#rgb / #rgba", example: "#0af / #0af8" },
  { syntax: "#rrggbb / #rrggbbaa", example: "#22d3ee / #22d3ee80" },
  { syntax: "rgb() / rgba()", example: "rgba(34, 211, 238, .5)  |  rgb(34 211 238 / 50%)", detail: "rgb() and rgba() are interchangeable (an alpha channel is optional on either name). Both the legacy comma syntax and the modern space+optional-slash-alpha syntax work." },
  { syntax: "hsl() / hsla()", example: "hsl(190, 94%, 54%)  |  hsl(190 94% 54% / 50%)", detail: "hsl() and hsla() are interchangeable, comma and modern syntax both work. Hue accepts deg/grad/rad/turn or a bare number." },
  { syntax: "named colors", example: "red, white, rebeccapurple", detail: "The full CSS Color 3 named-color keyword set (case-insensitive)." },
  { syntax: "transparent / currentColor", example: "currentColor" },
] as const;

/** Color functions that look like a color but are NOT implemented - fail loudly with `css-color-unsupported` rather than silently. Listed so an authoring AI can avoid them instead of discovering this by trial and error. */
export const UNSUPPORTED_COLOR_FORMATS = ["lab()", "lch()", "oklab()", "oklch()", "hwb()", "color()"] as const;

export const PAINT_CAPABILITY_NOTES = [
  {
    id: "gradient-functions",
    summary: "linear-gradient(), radial-gradient() and conic-gradient() - and their repeating- variants - are supported on background/background-image.",
    detail: "Color stops accept a percentage, a length (px/calc()), or (for conic) an angle; a bare `<color>` between two color stops is a color-interpolation hint, not a third stop. `to <side-or-corner>` and an explicit angle (deg/grad/rad/turn) both work for linear-gradient. radial-gradient supports circle/ellipse, the closest-side/farthest-side/closest-corner/farthest-corner extent keywords, an explicit size, and an `at <position>` (keywords, percentages or lengths).",
  },
  {
    id: "background-image-repeat-needs-size-for-raster-only",
    summary: "A repeating background-image needs an explicit two-dimensional background-size, but only for a raster url() image.",
    detail: "A gradient's generated image always exactly fills the background positioning area by spec, so linear-gradient()/radial-gradient()/conic-gradient() repeat (the CSS default) deterministically with no extra properties needed. A url() image has no known intrinsic size at compile time, so repeating one does require an explicit background-size plus background-repeat.",
  },
] as const;

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

/** A single percentage-or-bare-number channel token, e.g. one of rgb()'s r/g/b or hsl()'s alpha. */
function parsePercentOrNumber(token: string, max: number): number {
  return token.endsWith("%") ? (Number(token.slice(0, -1)) / 100) * max : Number(token);
}

function parseAlphaToken(token: string | undefined): number {
  if (token === undefined) return 1;
  return token.endsWith("%") ? Number(token.slice(0, -1)) / 100 : Number(token);
}

/**
 * Splits an rgb()/hsl() function body into its channel tokens plus an
 * optional alpha, accepting both legacy comma syntax (`r, g, b[, a]`) and
 * modern CSS Color 4 space syntax (`r g b[ / a]`) - real authors (and AI
 * tools generating CSS) use both interchangeably.
 */
function splitColorFunctionBody(body: string): { channels: string[]; alpha: string | undefined } {
  const slashIndex = body.indexOf("/");
  const channelPart = (slashIndex === -1 ? body : body.slice(0, slashIndex)).trim();
  const slashAlpha = slashIndex === -1 ? undefined : body.slice(slashIndex + 1).trim();
  const tokens = (channelPart.includes(",") ? channelPart.split(",") : channelPart.split(/\s+/))
    .map((token) => token.trim())
    .filter(Boolean);
  const commaAlpha = slashAlpha === undefined && tokens.length === 4 ? tokens.pop() : undefined;
  return { channels: tokens, alpha: slashAlpha ?? commaAlpha };
}

function parseRgbFunction(body: string, property: string, original: string): string {
  const { channels: channelTokens, alpha: alphaToken } = splitColorFunctionBody(body);
  if (channelTokens.length !== 3 || channelTokens.some((token) => !/^-?(?:\d+\.?\d*|\.\d+)%?$/.test(token))) {
    fail("css-color-invalid", `${property} contains an invalid rgb color: ${original}`);
  }
  const channels = channelTokens.map((token) => parsePercentOrNumber(token, 255));
  const alpha = parseAlphaToken(alphaToken);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    fail("css-color-invalid", `${property} contains an invalid rgb color: ${original}`);
  }
  return `#${[...channels, alpha * 255].map(toHexByte).join("")}`;
}

/** Degrees-normalized hue → sRGB, via the standard CSS Color 3 hsl-to-rgb algorithm. */
function hslToRgb(hueDegrees: number, saturation: number, lightness: number): [number, number, number] {
  const h = ((hueDegrees % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const ANGLE_TOKEN = /^(-?(?:\d+\.?\d*|\.\d+))(deg|grad|rad|turn)$/i;

function angleToDegrees(value: number, unit: string): number {
  const lower = unit.toLowerCase();
  if (lower === "grad") return value * 0.9;
  if (lower === "rad") return (value * 180) / Math.PI;
  if (lower === "turn") return value * 360;
  return value;
}

/** An `<angle>` token in degrees, or undefined if it isn't one. A bare `0` is accepted, as CSS allows for gradient angles. */
function parseAngleToken(token: string): number | undefined {
  if (token.trim() === "0") return 0;
  const match = token.trim().match(ANGLE_TOKEN);
  return match ? angleToDegrees(Number(match[1]), match[2]!) : undefined;
}

function hueToDegrees(token: string, property: string, original: string): number {
  const bare = token.match(/^(-?(?:\d+\.?\d*|\.\d+))$/);
  if (bare) return Number(bare[1]);
  const degrees = parseAngleToken(token);
  if (degrees === undefined) return fail("css-color-invalid", `${property} contains an invalid hsl hue: ${original}`);
  return degrees;
}

function parseHslFunction(body: string, property: string, original: string): string {
  const { channels: channelTokens, alpha: alphaToken } = splitColorFunctionBody(body);
  if (channelTokens.length !== 3) fail("css-color-invalid", `${property} contains an invalid hsl color: ${original}`);
  const [hueToken, saturationToken, lightnessToken] = channelTokens as [string, string, string];
  const hue = hueToDegrees(hueToken, property, original);
  if (!/^-?(?:\d+\.?\d*|\.\d+)%$/.test(saturationToken) || !/^-?(?:\d+\.?\d*|\.\d+)%$/.test(lightnessToken)) {
    fail("css-color-invalid", `${property} contains an invalid hsl saturation/lightness: ${original}`);
  }
  const saturation = Number(saturationToken.slice(0, -1)) / 100;
  const lightness = Number(lightnessToken.slice(0, -1)) / 100;
  const alpha = parseAlphaToken(alphaToken);
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail("css-color-invalid", `${property} contains an invalid hsl alpha: ${original}`);
  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return `#${[r, g, b, alpha * 255].map(toHexByte).join("")}`;
}

export function parseColor(value: string, property: string, currentColor = "#000000"): string {
  const v = value.trim().toLowerCase();
  if (v === "transparent" || (v === "none" && ["background", "background-color"].includes(property))) return "#00000000";
  if (v === "currentcolor") return parseColor(currentColor, "currentColor");
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9a-f]{4}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}${v[4]}${v[4]}`;
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v)) return v;
  const rgbMatch = v.match(/^rgba?\(([\s\S]+)\)$/i);
  if (rgbMatch) return parseRgbFunction(rgbMatch[1]!, property, value);
  const hslMatch = v.match(/^hsla?\(([\s\S]+)\)$/i);
  if (hslMatch) return parseHslFunction(hslMatch[1]!, property, value);
  const named = NAMED_COLORS[v];
  if (named) return named;
  return fail("css-color-unsupported", `${property} must resolve to a hex color: ${value}`);
}

/**
 * How a color-stop position resolves, mirroring Blink's
 * CSSGradientValue::AddStops(): a length (or calc()) is divided by the
 * gradient length - the gradient line for linear, the ending radius for
 * radial - and a conic stop takes an angle as a fraction of a full turn.
 * `length` is undefined only on the style-validation pass, which has no box
 * and discards the result.
 */
type StopResolution = { kind: "linear" | "radial" | "conic"; length: number | undefined };

function parseStopPosition(token: string, property: string, resolution: StopResolution): number {
  const plain = token.match(/^(-?(?:\d+\.?\d*|\.\d+))(%)?$/);
  if (plain) return Number(plain[1]) / (plain[2] ? 100 : 1);
  if (resolution.kind === "conic") {
    const degrees = parseAngleToken(token);
    if (degrees === undefined) fail("css-gradient-stop-invalid", `${property} conic color-stop positions must be percentages or angles: ${token}`);
    return (degrees as number) / 360;
  }
  const length = resolution.length ?? 100;
  const resolved = calcExpression(token, property, length, 16, 16, { width: length, height: length });
  if (!Number.isFinite(resolved.value) || resolved.unit !== "px") fail("css-gradient-stop-invalid", `${property} has an invalid color-stop offset: ${token}`);
  return length > 0 ? resolved.value / length : 0;
}

type ParsedStop = { color?: string; offset?: number };

function lerpHexColor(from: string, to: string, t: number): string {
  const channels = (hex: string) => [1, 3, 5, 7].map((index) => (index === 7 && hex.length === 7 ? 255 : Number.parseInt(hex.slice(index, index + 2), 16)));
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((channel, index) => toHexByte(channel + (b[index]! - channel) * t)).join("")}`;
}

/**
 * Blink's ReplaceColorHintsWithColorStops(): a color hint bends the
 * interpolation between its two neighbors to pos^(ln .5 / ln hint), which a
 * piecewise-linear Skia gradient approximates with 9 extra stops placed on
 * the curve (more of them on the side where it bends).
 */
function replaceColorHints(stops: Array<{ color?: string; offset: number }>): Array<{ color: string; offset: number }> {
  const result: Array<{ color: string; offset: number }> = [];
  stops.forEach((stop, index) => {
    if (stop.color !== undefined) {
      result.push({ color: stop.color, offset: stop.offset });
      return;
    }
    const left = stops[index - 1]!;
    const right = stops[index + 1]!;
    const leftColor = left.color!;
    const rightColor = right.color!;
    const leftDistance = stop.offset - left.offset;
    const rightDistance = right.offset - stop.offset;
    const totalDistance = right.offset - left.offset;
    if (Math.abs(leftDistance - rightDistance) < 1e-6) return;
    if (Math.abs(leftDistance) < 1e-6) {
      result.push({ color: rightColor, offset: stop.offset });
      return;
    }
    if (Math.abs(rightDistance) < 1e-6) {
      result.push({ color: leftColor, offset: stop.offset });
      return;
    }
    const offsets = leftDistance > rightDistance
      ? [...Array.from({ length: 7 }, (_, y) => left.offset + leftDistance * ((7 + y) / 13)), stop.offset + rightDistance / 3, stop.offset + (rightDistance * 2) / 3]
      : [left.offset + leftDistance / 3, left.offset + (leftDistance * 2) / 3, ...Array.from({ length: 7 }, (_, y) => stop.offset + rightDistance * (y / 13))];
    const hint = leftDistance / totalDistance;
    for (const offset of offsets) {
      const weighting = ((offset - left.offset) / totalDistance) ** (Math.log(0.5) / Math.log(hint));
      if (!Number.isFinite(weighting)) continue;
      result.push({ color: lerpHexColor(leftColor, rightColor, weighting), offset });
    }
  });
  return result;
}

/**
 * Collapse stops outside [0, 1] onto the boundary, interpolating the
 * boundary color (Blink's ClampNegativeOffsets, applied to both ends). For a
 * linear or conic gradient the [0, 1] range already spans everything the
 * gradient can paint, so the result is visually identical to Blink moving
 * its gradient points; radial handles its upper end by rescaling the radius
 * instead (see parseGradient).
 */
function clampStopsToUnitRange(stops: GradientStop[], clampHigh: boolean): GradientStop[] {
  const clampAt = (list: GradientStop[], boundary: number, beyond: (offset: number) => boolean): GradientStop[] => {
    const inside = list.filter((stop) => !beyond(stop.offset));
    const outside = list.filter((stop) => beyond(stop.offset));
    if (!outside.length) return list;
    const lastOutside = boundary === 0 ? outside[outside.length - 1]! : outside[0]!;
    const firstInside = boundary === 0 ? inside[0] : inside[inside.length - 1];
    const color = firstInside
      ? lerpHexColor(lastOutside.color, firstInside.color, (boundary - lastOutside.offset) / (firstInside.offset - lastOutside.offset))
      : lastOutside.color;
    return boundary === 0 ? [{ offset: 0, color }, ...inside] : [...inside, { offset: 1, color }];
  };
  const low = clampAt(stops, 0, (offset) => offset < 0);
  return clampHigh ? clampAt(low, 1, (offset) => offset > 1) : low;
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

/**
 * Tokenize and resolve a gradient's color-stop list the way Blink's
 * CSSGradientValue::AddStops() does. Tokens are split at the top level so a
 * color function with internal spaces (`rgba(255, 255, 255, .1) 50%`, the
 * form real authors and AI tools overwhelmingly write) stays one token.
 */
function normalizeStops(parts: string[], property: string, currentColor: string, repeating: boolean, resolution: StopResolution): GradientStop[] {
  if (parts.length < 2) fail("css-gradient-invalid", `${property} requires at least two color stops`);
  const parsed: ParsedStop[] = [];
  parts.forEach((part, partIndex) => {
    const tokens = splitTopLevel(part.replace(/\s+/g, " ").trim(), " ");
    if (!tokens[0]) fail("css-gradient-stop-invalid", `${property} contains an empty color stop`);
    if (tokens.length === 1 && !isPaintToken(tokens[0])) {
      // A bare position between two color stops is a color interpolation hint.
      if (partIndex === 0 || partIndex === parts.length - 1) fail("css-gradient-stop-invalid", `${property} color hint cannot be the first or last stop: ${part.trim()}`);
      if (parsed.at(-1)?.color === undefined) fail("css-gradient-stop-invalid", `${property} has two consecutive color hints: ${part.trim()}`);
      parsed.push({ offset: parseStopPosition(tokens[0], property, resolution) });
      return;
    }
    if (tokens.length > 3) fail("css-gradient-stop-invalid", `${property} color stop has too many values: ${part.trim()}`);
    const color = parseColor(tokens[0], property, currentColor);
    // `<color> <pos> <pos>` is shorthand for two stops of the same color.
    const positions = tokens.slice(1).map((token) => parseStopPosition(token, property, resolution));
    if (positions.length === 0) parsed.push({ color });
    else positions.forEach((offset) => parsed.push({ color, offset }));
  });
  const colorStops = parsed.filter((stop) => stop.color !== undefined);
  if (colorStops.length < 2) fail("css-gradient-invalid", `${property} requires at least two color stops`);
  const stops = parsed;
  if (stops[0]!.offset === undefined) stops[0]!.offset = 0;
  if (stops[stops.length - 1]!.offset === undefined) stops[stops.length - 1]!.offset = 1;
  let largestSpecified = stops[0]!.offset!;
  for (const stop of stops) {
    if (stop.offset === undefined) continue;
    if (stop.offset < largestSpecified) stop.offset = largestSpecified;
    largestSpecified = stop.offset;
  }
  let index = 0;
  while (index < stops.length) {
    if (stops[index]!.offset !== undefined) { index += 1; continue; }
    const start = index - 1;
    while (index < stops.length && stops[index]!.offset === undefined) index += 1;
    const end = index;
    const from = stops[start]!.offset!; const to = stops[end]!.offset!;
    for (let i = start + 1; i < end; i += 1) stops[i]!.offset = from + ((to - from) * (i - start)) / (end - start);
  }
  const resolved: GradientStop[] = replaceColorHints(stops as Array<{ color?: string; offset: number }>);
  if (!repeating) {
    if (resolution.kind === "radial") return clampStopsToUnitRange(resolved, false);
    const clamped = clampStopsToUnitRange(resolved, true);
    return clamped.length === 1 ? [clamped[0]!, { ...clamped[0]!, offset: 1 }] : clamped;
  }
  return repeatingStops(resolved, property);
}

function repeatingStops(stops: GradientStop[], property: string): GradientStop[] {
  const start = stops[0]!.offset!;
  const end = stops[stops.length - 1]!.offset!;
  const period = end - start;
  if (!Number.isFinite(period) || period <= 0) fail("css-gradient-period-invalid", `${property} repeating gradient must define a positive period`);
  // Keep the period in normalized gradient space. Skia's repeat tile mode
  // repeats the interval between the first and last stop; rescaling that
  // interval to 0..1 would produce one non-repeating gradient per box.
  return stops.map((stop) => ({ ...stop, offset: stop.offset! - start }));
}

const POSITION_X_KEYWORDS: Readonly<Record<string, number>> = { left: 0, center: 0.5, right: 1 };
const POSITION_Y_KEYWORDS: Readonly<Record<string, number>> = { top: 0, center: 0.5, bottom: 1 };

/** A radial/conic `at <position>` (one or two values: keywords, percentages or lengths) as fractions of the box. */
function parseGradientPosition(text: string, property: string, box: GradientBox | undefined): { x: number; y: number } {
  const width = box?.width ?? 100;
  const height = box?.height ?? 100;
  const axisValue = (token: string, axis: "x" | "y"): number => {
    const lower = token.toLowerCase();
    const keywords = axis === "x" ? POSITION_X_KEYWORDS : POSITION_Y_KEYWORDS;
    if (lower in keywords) return keywords[lower]!;
    if (lower in POSITION_X_KEYWORDS || lower in POSITION_Y_KEYWORDS) return fail("css-gradient-position-invalid", `${property} gradient position uses "${token}" on the wrong axis: ${text}`);
    const percent = token.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/);
    if (percent) return Number(percent[1]) / 100;
    const extent = axis === "x" ? width : height;
    const resolved = calcExpression(token, property, extent, 16, 16, { width, height });
    if (!Number.isFinite(resolved.value) || resolved.unit !== "px") fail("css-gradient-position-invalid", `${property} has an invalid gradient position: ${text}`);
    return extent > 0 ? resolved.value / extent : 0.5;
  };
  const tokens = text.trim().split(/\s+/);
  if (tokens.length === 1) {
    const lower = tokens[0]!.toLowerCase();
    if (lower === "top" || lower === "bottom") return { x: 0.5, y: POSITION_Y_KEYWORDS[lower]! };
    return { x: axisValue(tokens[0]!, "x"), y: 0.5 };
  }
  if (tokens.length === 2) {
    const [first, second] = tokens as [string, string];
    const swap = ["top", "bottom"].includes(first.toLowerCase()) || ["left", "right"].includes(second.toLowerCase());
    return swap ? { x: axisValue(second, "x"), y: axisValue(first, "y") } : { x: axisValue(first, "x"), y: axisValue(second, "y") };
  }
  return fail("css-gradient-position-invalid", `${property} gradient position supports one or two values: ${text}`);
}

/**
 * A `to <side-or-corner>` direction as a CSS angle in degrees. Sides are
 * fixed; a corner depends on the box's aspect ratio (the gradient line runs
 * perpendicular to the diagonal between the two neighboring corners), so it
 * is only 45deg for a square box.
 */
function linearDirectionDegrees(direction: string, property: string, box: GradientBox | undefined): number {
  const sides: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270 };
  const words = direction.toLowerCase().split(/\s+/).sort();
  if (words.length === 1 && words[0]! in sides) return sides[words[0]!]!;
  const corner = words.join(" ");
  const cornerAngle = box && box.width > 0 && box.height > 0 ? (Math.atan(box.height / box.width) * 180) / Math.PI : 45;
  const corners: Record<string, number> = { "right top": cornerAngle, "bottom right": 180 - cornerAngle, "bottom left": 180 + cornerAngle, "left top": 360 - cornerAngle };
  const angle = corners[corner];
  if (angle === undefined) return fail("css-gradient-direction-invalid", `${property} does not support direction: to ${direction}`);
  return angle;
}

const RADIAL_EXTENTS = new Set(["closest-side", "farthest-side", "closest-corner", "farthest-corner"]);

/**
 * The ending shape of a radial gradient, per CSS Images 3 §3.2.2: an
 * explicit size, or an extent keyword measured from the center to the box's
 * sides/corners (farthest-corner by default). An ellipse's corner extents
 * keep the aspect ratio of the matching side extent (x sqrt 2). Returns the
 * V2 normalization (circle radius against the smaller box axis, ellipse
 * radii against their own axes) plus the horizontal radius in pixels, which
 * is Blink's gradient length for resolving length color-stop positions.
 */
function radialEndingShape(sizeTokens: string[], center: { x: number; y: number }, box: GradientBox, property: string): { shape: "circle"; radius: number; lengthPx: number } | { shape: "ellipse"; radiusX: number; radiusY: number; lengthPx: number } {
  let shape: "circle" | "ellipse" | undefined;
  let extent: string | undefined;
  const lengths: string[] = [];
  for (const token of sizeTokens) {
    const lower = token.toLowerCase();
    if (lower === "circle" || lower === "ellipse") shape = lower;
    else if (RADIAL_EXTENTS.has(lower)) extent = lower;
    else lengths.push(token);
  }
  const resolvedShape = shape ?? (lengths.length === 1 ? "circle" : "ellipse");
  const px = (token: string, relative: number) => {
    const resolved = calcExpression(token, property, relative, 16, 16, box);
    if (!Number.isFinite(resolved.value) || resolved.unit !== "px" || resolved.value < 0) fail("css-gradient-size-invalid", `${property} has an invalid radial-gradient size: ${token}`);
    return resolved.value;
  };
  const minAxis = Math.min(box.width, box.height);
  if (lengths.length > 0) {
    if (extent) fail("css-gradient-size-invalid", `${property} radial-gradient cannot combine an extent keyword with an explicit size`);
    if (resolvedShape === "circle") {
      if (lengths.length !== 1 || lengths[0]!.endsWith("%")) fail("css-gradient-size-invalid", `${property} circle radial-gradient takes one non-percentage length`);
      const radius = px(lengths[0]!, box.width);
      return { shape: "circle", radius: radius / minAxis, lengthPx: radius };
    }
    if (lengths.length !== 2) fail("css-gradient-size-invalid", `${property} ellipse radial-gradient takes two lengths`);
    const rx = px(lengths[0]!, box.width);
    return { shape: "ellipse", radiusX: rx / box.width, radiusY: px(lengths[1]!, box.height) / box.height, lengthPx: rx };
  }
  const which = extent ?? "farthest-corner";
  if (resolvedShape === "circle") {
    const closestX = Math.min(center.x * box.width, (1 - center.x) * box.width);
    const closestY = Math.min(center.y * box.height, (1 - center.y) * box.height);
    const farthestX = Math.max(center.x * box.width, (1 - center.x) * box.width);
    const farthestY = Math.max(center.y * box.height, (1 - center.y) * box.height);
    const radius = which === "closest-side" ? Math.min(closestX, closestY)
      : which === "farthest-side" ? Math.max(farthestX, farthestY)
        : which === "closest-corner" ? Math.hypot(closestX, closestY)
          : Math.hypot(farthestX, farthestY);
    return { shape: "circle", radius: radius / minAxis, lengthPx: radius };
  }
  // Ellipse extents stay in box fractions so the default (farthest-corner)
  // lowers to exactly the same numbers it always has.
  const sideX = which.startsWith("closest") ? Math.min(center.x, 1 - center.x) : Math.max(center.x, 1 - center.x);
  const sideY = which.startsWith("closest") ? Math.min(center.y, 1 - center.y) : Math.max(center.y, 1 - center.y);
  const scale = which.endsWith("corner") ? Math.SQRT2 : 1;
  return { shape: "ellipse", radiusX: sideX * scale, radiusY: sideY * scale, lengthPx: sideX * scale * box.width };
}

function parseGradient(value: string, property: string, currentColor = "#000000", box?: GradientBox): Exclude<Paint, string> {
  const match = value.trim().match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i);
  if (!match) fail("css-gradient-unsupported", `${property} supports linear-gradient(), radial-gradient(), conic-gradient() and repeating variants`);
  const parsed = match as RegExpMatchArray; const repeating = Boolean(parsed[1]); const kind = parsed[2]!.toLowerCase() as "linear" | "radial" | "conic"; const args = splitTopLevel(parsed[3]!, ",");
  if (args.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const firstArg = args[0]!.replace(/\s+/g, " ").trim();
  const hasDescriptor = !isPaintToken(splitTopLevel(firstArg, " ")[0] ?? "");
  const descriptor = hasDescriptor ? firstArg : "";
  const stopParts = hasDescriptor ? args.slice(1) : args;
  if (stopParts.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const spreadMethod: GradientSpreadMethod | undefined = repeating ? "repeat" : undefined;

  if (kind === "linear") {
    let cssAngle = 180;
    if (/^to\s+/i.test(descriptor)) cssAngle = linearDirectionDegrees(descriptor.replace(/^to\s+/i, ""), property, box);
    else if (descriptor) {
      const degrees = parseAngleToken(descriptor);
      if (degrees === undefined) fail("css-gradient-direction-invalid", `${property} has an invalid linear direction: ${descriptor}`);
      cssAngle = degrees as number;
    }
    // Blink's gradient length: the gradient line through the box center, long enough to reach the corners.
    const radians = (cssAngle * Math.PI) / 180;
    const length = box ? Math.abs(box.width * Math.sin(radians)) + Math.abs(box.height * Math.cos(radians)) : undefined;
    const stops = normalizeStops(stopParts, property, currentColor, repeating, { kind, length });
    return { type: "linear-gradient", angle: cssLinearGradientAngleToRuntime(cssAngle), ...(spreadMethod ? { spreadMethod } : {}), stops };
  }

  const [sizeText = "", positionText] = descriptor.split(/\bat\b/i).map((part) => part.trim());
  if (descriptor && /\bat\b/i.test(descriptor) && !positionText) fail("css-gradient-position-invalid", `${property} gradient "at" needs a position: ${descriptor}`);
  const center = positionText ? parseGradientPosition(positionText, property, box) : undefined;

  if (kind === "radial") {
    const origin = center ?? { x: 0.5, y: 0.5 };
    const sizeTokens = sizeText ? sizeText.split(/\s+/) : [];
    const ending = box ? radialEndingShape(sizeTokens, origin, box, property) : undefined;
    let stops = normalizeStops(stopParts, property, currentColor, repeating, { kind, length: ending?.lengthPx });
    // Blink's AdjustGradientRadiiForOffsetRange(): a non-repeating stop list
    // that runs past 100% extends the ending shape instead of being cut off.
    let radiusScale = 1;
    const lastOffset = stops[stops.length - 1]!.offset;
    if (!repeating && lastOffset > 1) {
      radiusScale = lastOffset;
      stops = stops.map((stop) => ({ ...stop, offset: stop.offset / lastOffset }));
    }
    if (stops.length === 1) stops = [stops[0]!, { ...stops[0]!, offset: 1 }];
    // V2 stores a circle's radius against the smaller box axis and an
    // ellipse's radii against their own axes.
    const scaled = (value: number) => Math.max(1e-6, radiusScale === 1 ? value : value * radiusScale);
    const radii = ending
      ? ending.shape === "circle"
        ? { radius: scaled(ending.radius) }
        : { radiusX: scaled(ending.radiusX), radiusY: scaled(ending.radiusY) }
      : {};
    return { type: "radial-gradient", ...(center ? { cx: center.x, cy: center.y } : {}), ...radii, ...(spreadMethod ? { spreadMethod } : {}), stops };
  }

  const fromMatch = sizeText.match(/^from\s+(\S+)$/i);
  if (sizeText && !fromMatch) fail("css-gradient-direction-invalid", `${property} has an invalid conic-gradient descriptor: ${descriptor}`);
  const from = fromMatch ? parseAngleToken(fromMatch[1]!) : undefined;
  if (fromMatch && from === undefined) fail("css-gradient-direction-invalid", `${property} has an invalid conic-gradient angle: ${fromMatch[1]}`);
  const stops = normalizeStops(stopParts, property, currentColor, repeating, { kind, length: 1 });
  return { type: "conic-gradient", ...(from !== undefined ? { from } : {}), ...(center ? { cx: center.x, cy: center.y } : {}), ...(spreadMethod ? { spreadMethod } : {}), stops };
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
