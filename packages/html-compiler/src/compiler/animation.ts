import type { V2AnimatableValue, V2Easing, V2Track } from "@motionvideo/motion-protocol/v2";
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
  /** Arc length of the resolved offset-path in CSS user units. */
  motionPathLength?: number;
  /** Static perspective context used as the base for perspective tracks. */
  perspective?: { distance: number; origin: { x: number; y: number } };
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

/** `opacity` accepts a number or a percentage (`50%` = 0.5). */
function opacityNumber(value: string, fallback: number): number {
  const trimmed = value.trim();
  return trimmed.endsWith("%") ? number(String(Number(trimmed.slice(0, -1)) / 100), fallback) : number(trimmed, fallback);
}

function color(value: string, currentColor: string): { type: "color"; value: [number, number, number, number] } {
  const hex = parseColor(value, "animation color", currentColor).slice(1);
  const bytes = hex.length === 8 ? [0, 2, 4, 6].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) : [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).concat(255);
  return { type: "color", value: [bytes[0]! / 255, bytes[1]! / 255, bytes[2]! / 255, bytes[3]! / 255] };
}

// CSS Easing Functions Level 1 keyword equivalents (matches every browser's
// built-in mapping, not an approximation) for the keywords authors reach for
// most often before learning this compiler only accepts explicit values.
const KEYWORD_EASINGS: Record<string, V2Easing> = {
  ease: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  "ease-in": { type: "cubicBezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { type: "cubicBezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

/** Published through get_capabilities so an author (or agent) can discover valid values without a failed compile. */
export const SUPPORTED_ANIMATION_TIMING_FUNCTIONS = [
  "linear",
  ...Object.keys(KEYWORD_EASINGS),
  "cubic-bezier(x1, y1, x2, y2)",
  "steps(count, jump-start | jump-end | jump-none | jump-both | start | end)",
] as const;

/** Published through get_capabilities to explain css-animation-transform-conflict in CSS terms before an author hits it. */
export const ANIMATION_CAPABILITY_NOTES = [
  {
    id: "concurrent-transform-animations",
    summary: "Two animation-name entries on one element can't vary the same transform function.",
    detail:
      "A `transform` keyframe block resolves every translate/scale/rotate/skew component at once — functions it omits default to identity — so two concurrent animations on one element are each free to own a *different* transform function (e.g. one only translateY, the other only scale). But if both vary the same function, that's a conflict: CSS has no defined way to combine two animations writing the same transform function on one element. Merge them into a single @keyframes block that sets the full transform at each stop instead.",
  },
] as const;

function easing(value: string | undefined): V2Easing {
  const source = (value ?? "ease").trim().toLowerCase();
  if (source === "linear") return { type: "linear" };
  const keyword = KEYWORD_EASINGS[source];
  if (keyword) return keyword;
  const steps = source.match(/^steps\(\s*(\d+)\s*(?:,\s*(jump-start|jump-end|jump-none|jump-both|start|end))?\s*\)$/);
  if (steps) {
    const count = Number(steps[1]);
    if (!Number.isInteger(count) || count <= 0) fail("css-animation-easing-invalid", `steps() requires a positive integer count: ${value}`);
    return { type: "step", count, position: steps[2] === "start" ? "jump-start" : steps[2] === "end" ? "jump-end" : (steps[2] as "jump-start" | "jump-end" | "jump-none" | "jump-both" | undefined) ?? "jump-end" };
  }
  const bezier = source.match(/^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/);
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
    ["transform.translate.z", { type: "number", value: parsed.translate.z }],
    ["transform.scale.x", { type: "number", value: parsed.scale.x }],
    ["transform.scale.y", { type: "number", value: parsed.scale.y }],
    ["transform.scale.z", { type: "number", value: parsed.scale.z }],
    ["transform.rotate.x", { type: "number", value: parsed.rotate.x }],
    ["transform.rotate.y", { type: "number", value: parsed.rotate.y }],
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

function motionDistance(value: string, options: LowerAnimationOptions): number {
  const length = options.motionPathLength ?? 0;
  if (!(length > 0)) { fail("css-motion-path-invalid", "offset-distance requires a non-empty offset-path"); throw new Error("unreachable motion path length"); }
  const source = value.trim().toLowerCase();
  const percent = source.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/);
  if (percent) return Number(percent[1]) / 100;
  const resolved = calcExpression(value, "offset-distance", length, options.fontSize, 16, options.viewport).value;
  if (!Number.isFinite(resolved)) { fail("css-motion-distance-invalid", `offset-distance requires a finite length or percentage: ${value}`); throw new Error("unreachable motion distance"); }
  return resolved / length;
}

function motionAngle(value: string): number {
  if (!value.trim()) return 0;
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn)$/i);
  if (!match) { fail("css-motion-rotate-invalid", `offset-rotate animation requires an angle: ${value}`); throw new Error("unreachable motion angle"); }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return unit === "rad" ? (amount * 180) / Math.PI : unit === "turn" ? amount * 360 : amount;
}

function perspectiveDistance(value: string, options: LowerAnimationOptions): number {
  const resolved = calcExpression(value, "perspective", 1, options.fontSize, 16, options.viewport).value;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    fail("css-animation-perspective-invalid", `perspective keyframe requires a positive length: ${value}`);
  }
  return resolved;
}

function perspectiveOrigin(value: string, options: LowerAnimationOptions): { type: "vec2"; value: [number, number] } {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 2) {
    fail("css-animation-perspective-origin-invalid", `perspective-origin keyframe expects one or two values: ${value}`);
  }
  const keywordX: Record<string, string> = { left: "0%", center: "50%", right: "100%" };
  const keywordY: Record<string, string> = { top: "0%", center: "50%", bottom: "100%" };
  const first = tokens[0]!.toLowerCase();
  const second = tokens[1]?.toLowerCase();
  const xToken = first === "top" || first === "bottom"
    ? (second !== undefined && keywordX[second] !== undefined ? keywordX[second]! : "50%")
    : keywordX[first] ?? tokens[0]!;
  const yToken = first === "top" || first === "bottom"
    ? keywordY[first]!
    : second === undefined
      ? "50%"
      : keywordY[second] ?? tokens[1]!;
  const x = calcExpression(xToken, "perspective-origin", options.width, options.fontSize, 16, options.viewport).value;
  const y = calcExpression(yToken, "perspective-origin", options.height, options.fontSize, 16, options.viewport).value;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    fail("css-animation-perspective-origin-invalid", `perspective-origin keyframe requires finite coordinates: ${value}`);
  }
  return { type: "vec2", value: [x, y] };
}

function buildTrack(property: string, definition: KeyframeDefinition, durationMs: number, animation: NonNullable<V2Track["animation"]>, base: unknown, options: LowerAnimationOptions, defaultTiming: string): V2Track[] {
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
              : property === "offset-distance" ? "motion.offsetDistance"
                : property === "offset-rotate" ? "motion.offsetRotate.angle"
              : property === "perspective" ? "render3d.perspective.distance"
                : property === "perspective-origin" ? "render3d.perspective.origin"
              : property === "width" || property === "height" ? `frame.${property}` : property,
      ];
  return paths.map((path) => {
    const keyframes = known.map((entry) => {
      const raw = entry.declaration!.value;
      const value = transform
        ? transformValues(raw, options).get(path)!
        : property === "width" || property === "height" ? { type: "number" as const, value: frameSize(property as "width" | "height", raw, options) }
        : property === "border-width" ? { type: "number" as const, value: borderSize(raw, options) }
          : property === "offset-distance" ? { type: "number" as const, value: motionDistance(raw, options) }
            : property === "offset-rotate" ? { type: "number" as const, value: motionAngle(raw.replace(/^\s*(?:auto(?:-reverse)?|reverse)\s*/i, "")) }
              : property === "perspective" ? { type: "number" as const, value: perspectiveDistance(raw, options) }
                : property === "perspective-origin" ? perspectiveOrigin(raw, options)
              : property === "opacity" ? { type: "number" as const, value: opacityNumber(raw, 1) } : color(raw, options.currentColor);
      return { time: Math.round(entry.at * durationMs), value, easing: easing(styleTiming(definition, entry.at) ?? defaultTiming) };
    });
    // A synthesized leading keyframe (no explicit 0%/from) still starts the
    // animation's own declared timing function, not a forced linear ramp —
    // sampleKeyframes drives each segment from its *earlier* keyframe's
    // easing, so this is what actually governs the first segment's curve.
    if (keyframes[0]!.time > 0) keyframes.unshift({ time: 0, value: baseFor(path, base, options) as typeof keyframes[number]["value"], easing: easing(defaultTiming) });
    if (keyframes.at(-1)!.time < durationMs) keyframes.push({ time: durationMs, value: keyframes.at(-1)!.value, easing: { type: "linear" } });
    return { id: `animation:${definition.name}:${path}`, path, keyframes, animation } as V2Track;
  });
}

/** The CSS-identity value of a transform sub-path: the value it holds when the
 * function that drives it is entirely absent from a `transform` declaration.
 * translate.x/y fold in the static layout position (see transformValues),
 * so their "no-op" value is that offset, not literal 0. */
const TRANSFORM_FUNCTION_LABEL: Record<string, string> = {
  "transform.translate.x": "translateX()",
  "transform.translate.y": "translateY()",
  "transform.translate.z": "translateZ()",
  "transform.scale.x": "scaleX()",
  "transform.scale.y": "scaleY()",
  "transform.scale.z": "scaleZ()",
  "transform.rotate.x": "rotateX()",
  "transform.rotate.y": "rotateY()",
  "transform.rotate.z": "rotate() / rotateZ()",
  "transform.skew.x": "skewX()",
  "transform.skew.y": "skewY()",
};

/** A track's id is `animation:<keyframes-name>:<path>` (see buildTrack). */
function animationNameOf(track: V2Track): string {
  return track.id.slice("animation:".length, track.id.length - track.path.length - 1);
}

function transformIdentityValue(path: string, options: LowerAnimationOptions): number {
  if (path === "transform.translate.x") return options.layoutTranslate.x;
  if (path === "transform.translate.y") return options.layoutTranslate.y;
  if (path.startsWith("transform.scale.")) return 1;
  return 0;
}

function isIdentityTransformTrack(track: V2Track, identityValue: number): boolean {
  return track.keyframes.every(
    (keyframe) => keyframe.value.type === "number" && Math.abs(keyframe.value.value - identityValue) < 1e-6,
  );
}

/**
 * A `transform` keyframe block resolves every translate/scale/rotate/skew
 * sub-path (unspecified CSS functions default to identity), so two
 * concurrent animations that each vary a *different* transform function
 * (one only translateY, the other only scale, the common "fade up, then
 * pulse" pattern) both end up claiming all 11 sub-paths, colliding on the
 * ones neither actually authored. For each transform sub-path shared by more
 * than one animation on this element: if only one of them ever departs from
 * the CSS-identity value, that one is the real author — drop the others. If
 * two or more genuinely vary it, that is an authored conflict (CSS itself
 * has no defined way to combine them) and is left for schema validation to
 * reject. If every duplicate is identity, at most one survives, and only
 * when the element's own static transform isn't already identity there too
 * (needed to reset it, matching the runtime's transform-replacement
 * semantics — see sampleMotionLayerAtTime in motion-compiler).
 */
function resolveTransformTrackConflicts(tracks: V2Track[], style: Style, options: LowerAnimationOptions): V2Track[] {
  const byPath = new Map<string, V2Track[]>();
  for (const track of tracks) {
    if (!track.path.startsWith("transform.")) continue;
    const bucket = byPath.get(track.path);
    if (bucket) bucket.push(track);
    else byPath.set(track.path, [track]);
  }
  const drop = new Set<V2Track>();
  const transformBase = style.get("transform") ?? "none";
  for (const [path, bucket] of byPath) {
    if (bucket.length < 2) continue;
    const identityValue = transformIdentityValue(path, options);
    const authored = bucket.filter((track) => !isIdentityTransformTrack(track, identityValue));
    const identity = bucket.filter((track) => isIdentityTransformTrack(track, identityValue));
    if (authored.length >= 2) {
      const names = [...new Set(authored.map(animationNameOf))];
      fail(
        "css-animation-transform-conflict",
        `Two animations on the same element both animate ${TRANSFORM_FUNCTION_LABEL[path] ?? path}: ${names.map((name) => `"${name}"`).join(" and ")}. CSS has no defined way to combine two animations that write the same transform function on one element — merge them into a single @keyframes block that sets the full transform at each stop instead.`,
      );
    }
    if (authored.length === 1) {
      for (const track of identity) drop.add(track);
      continue;
    }
    const staticValue = (baseFor(path, transformBase, options) as { type: "number"; value: number }).value;
    const keep = Math.abs(staticValue - identityValue) > 1e-6 ? 1 : 0;
    for (const track of identity.slice(keep)) drop.add(track);
  }
  return drop.size ? tracks.filter((track) => !drop.has(track)) : tracks;
}

/**
 * Two `animation-name` entries that each animate the *same* non-transform
 * property path (opacity, background-color, width, ...) collide in Protocol
 * V2, which allows at most one track per path (`V2TrackListSchema`) - there
 * is no runtime "which one wins" rule for two independently-active tracks on
 * one path. But the extremely common case is NOT a real conflict: a fade-in
 * over [0, 1s] and an unrelated fade-out over [4s, 5s] never touch the same
 * instant at all. Each `buildTrack()` call already produces a complete,
 * self-contained local keyframe list for its own entry (including a
 * synthesized boundary keyframe at 0/durationMs via `baseFor` when the
 * author's own @keyframes doesn't cover it) - concatenating those lists in
 * absolute (delay-shifted) time reproduces exactly the shape the documented
 * single-@keyframes-with-percentage-offsets workaround already requires
 * authors to hand-write. Only sequential, single-iteration, normal-direction
 * entries are merged this way; anything else (genuine time overlap, or an
 * iteration-count/direction that has no finite flat timeline) still fails,
 * but with a specific diagnostic instead of Protocol V2's generic
 * "Duplicate animated property path".
 */
function mergeSequentialTracksOnSamePath(tracks: V2Track[]): V2Track[] {
  const byPath = new Map<string, V2Track[]>();
  for (const track of tracks) {
    // transform.* paths have their own, different conflict-resolution
    // mechanism (resolveTransformTrackConflicts) - leave them untouched.
    if (track.path.startsWith("transform.")) continue;
    const bucket = byPath.get(track.path);
    if (bucket) bucket.push(track);
    else byPath.set(track.path, [track]);
  }
  const drop = new Set<V2Track>();
  const additions: V2Track[] = [];
  for (const [path, bucket] of byPath) {
    if (bucket.length < 2) continue;
    const names = () => [...new Set(bucket.map(animationNameOf))].map((name) => `"${name}"`).join(", ");
    // A negative animation-delay is excluded too: the composition-wide
    // timeline length (animationTimelineDuration) credits a negative-delay
    // entry only `delay + duration` (its already-elapsed portion), not its
    // full local keyframe span, so a merged track built from one could carry
    // keyframe times past the layer's own computed duration.
    const notMergeable = bucket.filter((track) => track.animation!.iterations !== 1 || track.animation!.direction !== "normal" || track.animation!.delayMs < 0);
    if (notMergeable.length > 0) {
      fail(
        "css-animation-property-not-mergeable",
        `${bucket.length} animations on this element all animate ${path} (${names()}), and at least one uses animation-iteration-count other than 1 (including infinite), a negative animation-delay, or an animation-direction other than normal, so they can't be combined into one timeline automatically. Merge them into a single @keyframes block with percentage offsets instead.`,
      );
    }
    const sorted = [...bucket].sort((a, b) => a.animation!.delayMs - b.animation!.delayMs);
    for (let index = 1; index < sorted.length; index += 1) {
      const previousEnd = sorted[index - 1]!.animation!.delayMs + sorted[index - 1]!.animation!.durationMs;
      const currentStart = sorted[index]!.animation!.delayMs;
      if (currentStart < previousEnd) {
        fail(
          "css-animation-property-overlap",
          `${bucket.length} animations on this element all animate ${path} (${names()}), and their time ranges overlap, so there's no defined way to combine them. Merge them into a single @keyframes block with percentage offsets instead.`,
        );
      }
    }
    // Non-overlapping and eligible: concatenate each entry's own complete
    // local keyframe list into one merged timeline, in time relative to the
    // earliest entry's own delay (so a negative animation-delay on that
    // entry is preserved as the merged track's own delay, instead of pushing
    // any keyframe to a negative time). A later entry's keyframe wins when
    // two lists happen to touch at the exact same instant (the boundary
    // between one entry ending and the next starting).
    const baseDelayMs = sorted[0]!.animation!.delayMs;
    const merged = sorted.flatMap((track) => track.keyframes.map((keyframe) => ({ ...keyframe, time: keyframe.time + track.animation!.delayMs - baseDelayMs })));
    const keyframes = merged.filter((keyframe, index) => merged[index + 1]?.time !== keyframe.time);
    const durationMs = sorted.at(-1)!.animation!.delayMs + sorted.at(-1)!.animation!.durationMs - baseDelayMs;
    additions.push({
      id: `animation:${sorted.map(animationNameOf).join("+")}:${path}`,
      path,
      keyframes,
      animation: { durationMs, delayMs: baseDelayMs, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
    } as V2Track);
    for (const track of bucket) drop.add(track);
  }
  return drop.size ? [...tracks.filter((track) => !drop.has(track)), ...additions] : tracks;
}

function styleTiming(definition: KeyframeDefinition, at: number): string | undefined {
  const steps = definition.steps
    .filter((candidate) => candidate.selectors.some((selector) => Math.abs(offset(selector) - at) < 1e-9))
    .sort((a, b) => a.order - b.order);
  const step = steps.at(-1);
  return [...(step?.declarations ?? [])].reverse().find((declaration) => declaration.property === "animation-timing-function")?.value;
}

function baseFor(path: string, base: unknown, options: LowerAnimationOptions): V2AnimatableValue {
  if (path === "style.fill") return color(typeof base === "string" ? base : options.currentColor, options.currentColor);
  if (path === "style.stroke") return color(typeof base === "string" ? base : options.currentColor, options.currentColor);
  if (path === "style.strokeWidth") return { type: "number", value: typeof base === "number" ? base : borderSize(String(base ?? "0px"), options) };
  if (path === "opacity") return { type: "number", value: typeof base === "number" ? base : opacityNumber(String(base ?? "1"), 1) };
  if (path.startsWith("transform.")) {
    // When @keyframes omit 0%, CSS synthesizes it from the underlying
    // transform declaration. Preserve every base component (including rotate,
    // scale and skew), while explicit keyframes continue to resolve omitted
    // transform functions to identity through transformValues().
    return transformValues(typeof base === "string" ? base : "none", options).get(path)
      ?? { type: "number", value: 0 };
  }
  if (path === "frame.width") return { type: "number", value: options.baseFrame.width };
  if (path === "frame.height") return { type: "number", value: options.baseFrame.height };
  if (path === "motion.offsetDistance") return { type: "number", value: typeof base === "number" ? base : motionDistance(String(base ?? "0%"), options) };
  if (path === "motion.offsetRotate.angle") return { type: "number", value: typeof base === "number" ? base : 0 };
  if (path === "render3d.perspective.distance") return { type: "number", value: typeof base === "number" ? base : options.perspective?.distance ?? 1 };
  if (path === "render3d.perspective.origin") {
    if (Array.isArray(base) && base.length === 2 && base.every((value) => typeof value === "number")) return { type: "vec2", value: [base[0]!, base[1]!] };
    return { type: "vec2", value: [options.perspective?.origin.x ?? options.width / 2, options.perspective?.origin.y ?? options.height / 2] };
  }
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
  const allTracks: V2Track[] = [];
  names.forEach((name, index) => {
    if (name === "none") return;
    const definition = keyframes.get(name) ?? fail("css-animation-name-unknown", `animation-name references unknown @keyframes: ${name}`);
    const durationMs = timeMs(durations[index % durations.length] ?? durations[0]!);
    if (durationMs <= 0) return;
    const iterationToken = iterations[index % iterations.length] ?? iterations[0]!;
    const iterationValue = iterationToken === "infinite" ? "infinite" as const : Math.max(0, number(iterationToken, 1));
    const animation = { durationMs, delayMs: timeMs(delays[index % delays.length] ?? delays[0]!, true), iterations: iterationValue, direction: (directions[index % directions.length] ?? directions[0]!) as NonNullable<V2Track["animation"]>["direction"], fillMode: (fills[index % fills.length] ?? fills[0]!) as NonNullable<V2Track["animation"]>["fillMode"], playState: (states[index % states.length] ?? states[0]!) as NonNullable<V2Track["animation"]>["playState"] };
    const easingValue = timings[index % timings.length] ?? timings[0]!;
    const supported: string[] = ["opacity", "transform", "background-color", "border-color", "border-width", "width", "height", "perspective", "perspective-origin"];
    const offsetPathValue = style.get("offset-path");
    if (offsetPathValue !== undefined && offsetPathValue.trim().toLowerCase() !== "none") {
      supported.push("offset-distance", "offset-rotate");
    }
    for (const property of supported) {
      const base = property === "opacity"
        ? style.get("opacity") ?? "1"
        : property === "background-color"
          ? style.get("background-color") ?? options.currentColor
          : property === "border-color"
            ? style.get("border-top-color") ?? style.get("border-color") ?? options.currentColor
            : property === "border-width"
              ? style.get("border-top-width") ?? style.get("border-width") ?? "0px"
              : property === "offset-distance"
                ? style.get("offset-distance") ?? "0%"
              : property === "offset-rotate"
                  ? style.get("offset-rotate") ?? "auto"
            : property === "perspective"
              ? style.get("perspective") ?? (options.perspective ? `${options.perspective.distance}px` : "none")
              : property === "perspective-origin"
                ? style.get("perspective-origin") ?? (options.perspective ? `${options.perspective.origin.x}px ${options.perspective.origin.y}px` : "50% 50%")
            : property === "transform"
              ? style.get("transform") ?? "none"
            : property === "width" || property === "height"
            ? options.baseFrame[property]
            : "none";
      const baseValue = property === "opacity"
        ? (typeof base === "number" ? base : opacityNumber(base, 1))
        : property === "transform"
          ? base
        : property === "border-width"
          ? borderSize(String(base), options)
          : property === "offset-distance"
            ? motionDistance(String(base), options)
          : property === "offset-rotate"
              ? (() => { const raw = String(base).replace(/^\s*(?:auto(?:-reverse)?|reverse)\s*/i, ""); return raw ? motionAngle(raw) : 0; })()
          : property === "perspective"
            ? (String(base).trim().toLowerCase() === "none"
              ? options.perspective?.distance ?? 1
              : perspectiveDistance(String(base), options))
            : property === "perspective-origin"
              ? perspectiveOrigin(String(base), options).value
          : base;
      const tracks = buildTrack(property, definition, durationMs, animation, baseValue, options, easingValue);
      allTracks.push(...tracks);
    }
  });
  const mergedTracks = mergeSequentialTracksOnSamePath(allTracks);
  const group: V2Track[] = [];
  const paint: V2Track[] = [];
  for (const track of mergedTracks) (track.path.startsWith("transform.") || track.path.startsWith("motion.") || track.path.startsWith("render3d.") || track.path === "opacity" || track.path.startsWith("frame.") ? group : paint).push(track);
  return { group: resolveTransformTrackConflicts(group, style, options), paint };
}

/**
 * `lowerAnimationTracks` plus the two downstream splits every caller needs:
 * the paint-layer subset (background-color and, for a paint-grouped element,
 * the width/height tracks its paint children must also follow) and the
 * border-paint subset (border-color/border-width).
 */
export function resolveNodeAnimationTracks(style: Style, keyframes: Map<string, KeyframeDefinition>, options: LowerAnimationOptions): {
  group: V2Track[];
  paint: V2Track[];
  paintAnimationTracks: V2Track[];
  borderAnimationTracks: V2Track[];
} {
  const tracks = lowerAnimationTracks(style, keyframes, options);
  const paintAnimationTracks = [
    ...tracks.paint.filter((track) => track.path === "style.fill"),
    ...tracks.group.filter((track) => track.path === "frame.width" || track.path === "frame.height"),
  ];
  const borderAnimationTracks = tracks.paint.filter((track) => track.path === "style.stroke" || track.path === "style.strokeWidth");
  return { ...tracks, paintAnimationTracks, borderAnimationTracks };
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
