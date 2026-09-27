import { fail } from "../errors";
import { calcExpression, isPaintToken } from "../css/values";
import { splitTopLevel } from "../utils";
import { parseColor } from "./paint";

export type HtmlFilterEffect =
  | { id: string; type: "blur"; radius: number }
  | { id: string; type: "color-adjust"; brightness: number; contrast: number; saturation: number; hueRotate: number }
  | { id: string; type: "grayscale"; amount: number }
  | { id: string; type: "sepia"; amount: number }
  | { id: string; type: "invert"; amount: number }
  | { id: string; type: "filter-opacity"; amount: number }
  | { id: string; type: "shadow"; source: "alpha"; offset: { x: number; y: number }; blur: number; spread: 0; color: string; inset: false };

function parseFunctions(value: string): Array<{ name: string; body: string }> {
  const result: Array<{ name: string; body: string }> = [];
  let cursor = 0;
  while (cursor < value.length) {
    while (/\s/.test(value[cursor] ?? "")) cursor += 1;
    if (cursor >= value.length) break;
    const match = value.slice(cursor).match(/^([a-z-]+)\(/i);
    if (!match) {
      fail("css-filter-invalid", `filter contains unsupported syntax near: ${value.slice(cursor)}`);
    }
    const parsed = match!;
    const name = parsed[1]!.toLowerCase();
    const start = cursor + parsed[0]!.length;
    let depth = 1;
    let end = start;
    while (end < value.length && depth > 0) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") depth -= 1;
      end += 1;
    }
    if (depth !== 0) fail("css-filter-invalid", `filter ${name}() has an unclosed parenthesis`);
    result.push({ name, body: value.slice(start, end - 1).trim() });
    cursor = end;
  }
  return result;
}

function tokens(body: string): string[] { return body ? splitTopLevel(body, " ").filter(Boolean) : []; }

function numberValue(value: string, property: string, viewport: { width: number; height: number }, fontSize: number, relative: number): number {
  const resolved = calcExpression(value, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(resolved.value) || (resolved.unit !== "number" && resolved.unit !== "px")) fail("css-filter-number-invalid", `${property} must resolve to a finite number: ${value}`);
  return resolved.value;
}

function lengthValue(value: string, property: string, viewport: { width: number; height: number }, fontSize: number, relative: number): number {
  const resolved = calcExpression(value, property, relative, fontSize, 16, viewport);
  // CSS accepts unitless zero anywhere a <length> is expected. Keeping this
  // normalization here is important for drop-shadow(0 0 0 ...), where the
  // zero-blur probe intentionally exercises the alpha silhouette path.
  if (!Number.isFinite(resolved.value) || (resolved.unit !== "px" && !(resolved.value === 0 && resolved.unit === "number"))) fail("css-filter-length-invalid", `${property} must resolve to a finite length: ${value}`);
  return resolved.value;
}

function angleDegreesValue(value: string, property: string, viewport: { width: number; height: number }, fontSize: number, relative: number): number {
  const resolved = calcExpression(value, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(resolved.value) || (resolved.unit !== "angle" && !(resolved.value === 0 && resolved.unit === "number"))) fail("css-filter-number-invalid", `${property} must resolve to an angle: ${value}`);
  return resolved.unit === "angle" ? (resolved.value * 180) / Math.PI : 0;
}

function clampedAmount(value: string, property: string, viewport: { width: number; height: number }, fontSize: number): number {
  return Math.min(1, Math.max(0, numberValue(value, property, viewport, fontSize, 1)));
}

function colorAdjust(id: string, brightness = 0, contrast = 1, hueRotate = 0, saturation = 1): HtmlFilterEffect {
  return { id, type: "color-adjust", brightness, contrast, saturation, hueRotate };
}

function dropShadow(body: string, id: string, viewport: { width: number; height: number }, fontSize: number, relative: number, currentColor: string): HtmlFilterEffect {
  let color: string | undefined;
  const lengths: string[] = [];
  for (const token of tokens(body)) {
    if (isPaintToken(token)) {
      if (color !== undefined) fail("css-filter-drop-shadow-invalid", "drop-shadow() contains more than one color");
      color = token;
    } else lengths.push(token);
  }
  if (lengths.length < 2 || lengths.length > 3) fail("css-filter-drop-shadow-invalid", "drop-shadow() expects two or three lengths");
  const blur = lengths[2] === undefined ? 0 : lengthValue(lengths[2], "filter.drop-shadow.blur", viewport, fontSize, relative);
  if (blur < 0) fail("css-filter-drop-shadow-invalid", "drop-shadow() blur must be non-negative");
  return { id, type: "shadow", source: "alpha", offset: { x: lengthValue(lengths[0]!, "filter.drop-shadow.offset-x", viewport, fontSize, relative), y: lengthValue(lengths[1]!, "filter.drop-shadow.offset-y", viewport, fontSize, relative) }, blur, spread: 0, color: parseColor(color ?? currentColor, "drop-shadow", currentColor), inset: false };
}

export function parseFilter(value: string | undefined, relative: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): HtmlFilterEffect[] {
  return parseFilterFunctions(value, relative, fontSize, viewport, currentColor).map((entry) => entry.effect);
}

/**
 * Like parseFilter, but keeps each effect's CSS function name. Several
 * functions share one V2 effect type (brightness/contrast/saturate/hue-rotate
 * are all `color-adjust`), and filter-list interpolation pairs functions by
 * name, not by lowered type.
 */
export function parseFilterFunctions(value: string | undefined, relative: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): Array<{ name: string; effect: HtmlFilterEffect }> {
  const raw = value?.trim();
  if (!raw || raw.toLowerCase() === "none") return [];
  return parseFunctions(raw).map(({ name, body }, index) => ({ name, effect: parseFilterFunction(name, body, `filter:${index}`, relative, fontSize, viewport, currentColor) }));
}

function parseFilterFunction(name: string, body: string, id: string, relative: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): HtmlFilterEffect {
  const values = tokens(body);
  if (name === "blur") {
    if (values.length !== 1) fail("css-filter-invalid", "blur() expects one length");
    const radius = lengthValue(values[0]!, "filter.blur", viewport, fontSize, relative);
    if (radius < 0) fail("css-filter-blur-invalid", "blur() radius must be non-negative");
    return { id, type: "blur", radius };
  }
  if (name === "brightness" || name === "contrast") {
    if (values.length !== 1) fail("css-filter-invalid", `${name}() expects one number or percentage`);
    const factor = numberValue(values[0]!, `filter.${name}`, viewport, fontSize, 1);
    if (factor < 0 || factor > 4) fail("css-filter-amount-unsupported", `${name}() must resolve within 0..4`);
    if (name === "contrast") return colorAdjust(id, 0, factor);
    if (factor === 0) return colorAdjust(id, -1, 1);
    // CSS brightness(f) is a channel multiplication. The existing V2
    // color-adjust applies contrast around the normalized midpoint and then
    // adds brightness. Together, contrast=f and brightness=.5*(f-1) are
    // exactly the channel multiplication used by CSS brightness(f).
    const additive = 0.5 * (factor - 1);
    if (additive < -1 || additive > 1) fail("css-filter-amount-unsupported", "brightness() cannot be represented by the V2 color-adjust bounds");
    return colorAdjust(id, additive, factor);
  }
  if (name === "saturate") {
    if (values.length !== 1) fail("css-filter-invalid", "saturate() expects one number or percentage");
    // Unlike grayscale()/sepia(), saturate() is not clamped to 1: CSS allows oversaturation (e.g. 180%).
    const factor = numberValue(values[0]!, "filter.saturate", viewport, fontSize, 1);
    if (factor < 0 || factor > 4) fail("css-filter-amount-unsupported", "saturate() must resolve within 0..4");
    return colorAdjust(id, 0, 1, 0, factor);
  }
  if (name === "hue-rotate") {
    if (values.length !== 1) fail("css-filter-invalid", "hue-rotate() expects one angle");
    const hueRotate = angleDegreesValue(values[0]!, "filter.hue-rotate", viewport, fontSize, relative);
    return colorAdjust(id, 0, 1, hueRotate);
  }
  if (["grayscale", "sepia", "invert", "opacity"].includes(name)) {
    if (values.length !== 1) fail("css-filter-invalid", `${name}() expects one number or percentage`);
    const normalized = clampedAmount(values[0]!, `filter.${name}`, viewport, fontSize);
    if (name === "grayscale") return { id, type: "grayscale", amount: normalized };
    if (name === "sepia") return { id, type: "sepia", amount: normalized };
    if (name === "invert") return { id, type: "invert", amount: normalized };
    return { id, type: "filter-opacity", amount: normalized };
  }
  if (name === "drop-shadow") return dropShadow(body, id, viewport, fontSize, relative, currentColor);
  return fail("css-filter-unsupported", `Unsupported filter function: ${name}()`);
}
