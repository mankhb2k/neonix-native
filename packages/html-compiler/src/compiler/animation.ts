import type { V2Easing, V2Track } from "@motionvideo/motion-protocol/v2";
import { parseColor } from "./paint";
import { parseTransform } from "./transform";
import { splitTopLevel } from "./utils";
import { calcExpression } from "./values";
import { fail } from "./errors";
import type { KeyframeDefinition, Style } from "./model";

type LowerAnimationOptions = {
  width: number;
  height: number;
  fontSize: number;
  viewport: { width: number; height: number };
  currentColor: string;
  /** The layout translation is not part of CSS transform and must survive an animated transform track. */
  layoutTranslate: { x: number; y: number };
  containingWidth: number;
  containingHeight: number;
  baseFrame: { width: number; height: number };
  boxSizing: "content-box" | "border-box";
  frameDecorations: { width: number; height: number };
};

function list(value: string | undefined, fallback: string): string[] {
  return splitTopLevel(value ?? fallback, ",").map((item) => item.trim()).filter(Boolean);
}

function timeMs(value: string, allowNegative = false): number {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/i);
  if (!match) throw new Error(`Invalid animation time: ${value}`);
  const amount = Number(match[1]);
  const resolved = match[2]!.toLowerCase() === "s" ? amount * 1000 : amount;
  return allowNegative ? resolved : Math.max(0, resolved);
}

function number(value: string, fallback: number): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function color(value: string, currentColor: string): { type: "color"; value: [number, number, number, number] } {
  const hex = parseColor(value, "animation color", currentColor).slice(1);
  const bytes = hex.length === 8 ? [0, 2, 4, 6].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) : [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).concat(255);
  return { type: "color", value: [bytes[0]! / 255, bytes[1]! / 255, bytes[2]! / 255, bytes[3]! / 255] };
}

function easing(value: string | undefined): V2Easing {
  const source = (value ?? "ease").trim().toLowerCase();
  if (source === "linear") return { type: "linear" };
  if (source === "ease") return { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
  const steps = source.match(/^steps\(\s*(\d+)\s*(?:,\s*(jump-start|jump-end|jump-none|jump-both|start|end))?\s*\)$/);
  if (steps) {
    const count = Number(steps[1]);
    if (!Number.isInteger(count) || count <= 0) fail("css-animation-easing-invalid", `steps() requires a positive integer count: ${value}`);
    return { type: "step", count, position: steps[2] === "start" ? "jump-start" : steps[2] === "end" ? "jump-end" : (steps[2] as "jump-start" | "jump-end" | "jump-none" | "jump-both" | undefined) ?? "jump-end" };
  }
  const bezier = source.match(/^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)$/);
  if (bezier) {
    const values = bezier.slice(1).map((item) => Number(item.trim()));
    const [x1, y1, x2, y2] = values;
    if (!values.every(Number.isFinite) || x1! < 0 || x1! > 1 || x2! < 0 || x2! > 1) {
      fail("css-animation-easing-invalid", `cubic-bezier() requires finite values with x1/x2 in [0, 1]: ${value}`);
    }
    return { type: "cubicBezier", x1: x1!, y1: y1!, x2: x2!, y2: y2! };
  }
  fail("css-animation-easing-invalid", `Unsupported animation timing function: ${value}`);
  throw new Error("unreachable easing branch");
}

function offset(selector: string): number {
  const value = selector.trim().toLowerCase();
  if (value === "from") return 0;
  if (value === "to") return 1;
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) throw new Error(`Invalid @keyframes selector: ${selector}`);
  return Math.max(0, Math.min(1, Number(match[1]) / 100));
}

function transformValues(value: string, options: LowerAnimationOptions): Map<string, { type: "number"; value: number }> {
  const style: Style = new Map([["transform", value], ["transform-origin", "center"]]);
  const parsed = parseTransform(style, options.width, options.height, options.fontSize, options.viewport);
  return new Map([
    // V2 component tracks write the resolved layer transform fields. CSS
    // transform is painted on top of layout, so preserve the layout origin
    // while lowering the animated local transform value.
    ["transform.translate.x", { type: "number", value: options.layoutTranslate.x + parsed.translate.x }],
    ["transform.translate.y", { type: "number", value: options.layoutTranslate.y + parsed.translate.y }],
    ["transform.scale.x", { type: "number", value: parsed.scale.x }],
    ["transform.scale.y", { type: "number", value: parsed.scale.y }],
    ["transform.rotate.z", { type: "number", value: parsed.rotate.z }],
    ["transform.skew.x", { type: "number", value: parsed.skew.x }],
    ["transform.skew.y", { type: "number", value: parsed.skew.y }],
  ]);
}

function frameSize(property: "width" | "height", value: string, options: LowerAnimationOptions): number {
  const relative = property === "width" ? options.containingWidth : options.containingHeight;
  const resolved = calcExpression(value, property, relative, options.fontSize, 16, options.viewport).value;
  if (!Number.isFinite(resolved) || resolved < 0) throw new Error(`${property} keyframe requires a finite non-negative length: ${value}`);
  return options.boxSizing === "border-box"
    ? resolved
    : resolved + options.frameDecorations[property];
}

function borderSize(value: string, options: LowerAnimationOptions): number {
  const resolved = calcExpression(value, "border-width", options.containingWidth, options.fontSize, 16, options.viewport).value;
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-animation-border-width-invalid", `border-width keyframe requires a finite non-negative length: ${value}`);
  return resolved;
}

function buildTrack(property: string, definition: KeyframeDefinition, durationMs: number, playback: NonNullable<V2Track["playback"]>, base: unknown, options: LowerAnimationOptions, defaultTiming: string): V2Track[] {
  const entries = definition.steps.flatMap((step) => step.selectors.map((selector) => ({
    at: offset(selector),
    // Declarations in one keyframe block still follow the normal CSS cascade:
    // the last declaration for a property wins.
    declaration: [...step.declarations].reverse().find((item) => item.property === property),
    order: step.order,
  })));
  const ordered = entries.filter((entry) => entry.declaration !== undefined).sort((a, b) => a.at - b.at || a.order - b.order);
  // CSS keyframe blocks at the same offset cascade by source order. Keep the
  // winning block per property instead of emitting duplicate-time keyframes,
  // which would make the runtime's interpolation result backend-dependent.
  const known = ordered.filter((entry, index) => ordered[index + 1]?.at !== entry.at);
  if (!known.length) return [];
  const transform = property === "transform";
  const paths = transform
    ? [...transformValues(known[0]!.declaration!.value, options).keys()]
    : [
        property === "background-color" ? "style.fill"
          : property === "border-color" ? "style.stroke"
            : property === "border-width" ? "style.strokeWidth"
              : property === "width" || property === "height" ? `frame.${property}` : property,
      ];
  return paths.map((path) => {
    const keyframes = known.map((entry) => {
      const raw = entry.declaration!.value;
      const value = transform
        ? transformValues(raw, options).get(path)!
        : property === "width" || property === "height" ? { type: "number" as const, value: frameSize(property as "width" | "height", raw, options) }
        : property === "border-width" ? { type: "number" as const, value: borderSize(raw, options) }
          : property === "opacity" ? { type: "number" as const, value: number(raw, 1) } : color(raw, options.currentColor);
      return { time: Math.round(entry.at * durationMs), value, easing: easing(styleTiming(definition, entry.at) ?? defaultTiming) };
    });
    if (keyframes[0]!.time > 0) keyframes.unshift({ time: 0, value: baseFor(path, base, options), easing: { type: "linear" } });
    if (keyframes.at(-1)!.time < durationMs) keyframes.push({ time: durationMs, value: keyframes.at(-1)!.value, easing: { type: "linear" } });
    return { id: `animation:${definition.name}:${path}`, path, keyframes, playback } as V2Track;
  });
}

function styleTiming(definition: KeyframeDefinition, at: number): string | undefined {
  const steps = definition.steps
    .filter((candidate) => candidate.selectors.some((selector) => Math.abs(offset(selector) - at) < 1e-9))
    .sort((a, b) => a.order - b.order);
  const step = steps.at(-1);
  return [...(step?.declarations ?? [])].reverse().find((declaration) => declaration.property === "animation-timing-function")?.value;
}

function baseFor(path: string, base: unknown, options: LowerAnimationOptions): { type: "number"; value: number } | { type: "color"; value: [number, number, number, number] } {
  if (path === "style.fill") return color(typeof base === "string" ? base : options.currentColor, options.currentColor);
  if (path === "style.stroke") return color(typeof base === "string" ? base : options.currentColor, options.currentColor);
  if (path === "style.strokeWidth") return { type: "number", value: typeof base === "number" ? base : borderSize(String(base ?? "0px"), options) };
  if (path === "opacity") return { type: "number", value: typeof base === "number" ? base : number(String(base ?? "1"), 1) };
  if (path === "transform.translate.x") return { type: "number", value: options.layoutTranslate.x };
  if (path === "transform.translate.y") return { type: "number", value: options.layoutTranslate.y };
  if (path === "frame.width") return { type: "number", value: options.baseFrame.width };
  if (path === "frame.height") return { type: "number", value: options.baseFrame.height };
  if (path === "transform.scale.x" || path === "transform.scale.y") return { type: "number", value: 1 };
  return { type: "number", value: 0 };
}

export function lowerAnimationTracks(style: Style, keyframes: Map<string, KeyframeDefinition>, options: LowerAnimationOptions): { group: V2Track[]; paint: V2Track[] } {
  const names = list(style.get("animation-name"), "none");
  const durations = list(style.get("animation-duration"), "0s");
  const delays = list(style.get("animation-delay"), "0s");
  const iterations = list(style.get("animation-iteration-count"), "1");
  const directions = list(style.get("animation-direction"), "normal");
  const fills = list(style.get("animation-fill-mode"), "none");
  const states = list(style.get("animation-play-state"), "running");
  // CSS animation-timing-function defaults to ease, not linear.
  const timings = list(style.get("animation-timing-function"), "ease");
  const group: V2Track[] = [];
  const paint: V2Track[] = [];
  names.forEach((name, index) => {
    if (name === "none") return;
    const definition = keyframes.get(name) ?? fail("css-animation-name-unknown", `animation-name references unknown @keyframes: ${name}`);
    const durationMs = timeMs(durations[index % durations.length] ?? durations[0]!);
    if (durationMs <= 0) return;
    const iterationToken = iterations[index % iterations.length] ?? iterations[0]!;
    const iterationValue = iterationToken === "infinite" ? "infinite" as const : Math.max(0, number(iterationToken, 1));
    const playback = { durationMs, delayMs: timeMs(delays[index % delays.length] ?? delays[0]!, true), iterations: iterationValue, direction: (directions[index % directions.length] ?? directions[0]!) as NonNullable<V2Track["playback"]>["direction"], fillMode: (fills[index % fills.length] ?? fills[0]!) as NonNullable<V2Track["playback"]>["fillMode"], playState: (states[index % states.length] ?? states[0]!) as NonNullable<V2Track["playback"]>["playState"] };
    const easingValue = timings[index % timings.length] ?? timings[0]!;
    const supported = ["opacity", "transform", "background-color", "border-color", "border-width", "width", "height"] as const;
    for (const property of supported) {
      const base = property === "opacity"
        ? style.get("opacity") ?? "1"
        : property === "background-color"
          ? style.get("background-color") ?? options.currentColor
          : property === "border-color"
            ? style.get("border-top-color") ?? style.get("border-color") ?? options.currentColor
            : property === "border-width"
              ? style.get("border-top-width") ?? style.get("border-width") ?? "0px"
          : property === "width" || property === "height"
            ? options.baseFrame[property]
            : "none";
      const baseValue = property === "opacity"
        ? (typeof base === "number" ? base : number(base, 1))
        : property === "border-width"
          ? borderSize(String(base), options)
          : base;
      const tracks = buildTrack(property, definition, durationMs, playback, baseValue, options, easingValue);
      for (const track of tracks) (track.path.startsWith("transform.") || track.path === "opacity" || track.path.startsWith("frame.") ? group : paint).push(track);
    }
  });
  return { group, paint };
}

/** Returns the minimum layer timeline needed to expose a finite animation. */
export function animationTimelineDuration(style: Style): number {
  const names = list(style.get("animation-name"), "none");
  if (names.every((name) => name === "none")) return 0;
  const durations = list(style.get("animation-duration"), "0s");
  const delays = list(style.get("animation-delay"), "0s");
  const iterations = list(style.get("animation-iteration-count"), "1");
  return names.reduce((maximum, name, index) => {
    if (name === "none") return maximum;
    const duration = timeMs(durations[index % durations.length] ?? durations[0]!);
    const delay = timeMs(delays[index % delays.length] ?? delays[0]!, true);
    const count = iterations[index % iterations.length] ?? iterations[0]!;
    const total = count === "infinite" ? delay + duration : delay + duration * Math.max(0, number(count, 1));
    return Math.max(maximum, total);
  }, 0);
}
