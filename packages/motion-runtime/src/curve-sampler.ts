/** Deterministic unit curve samplers for Motion Format v2 professional interpolation (R2). */
import type { KeyframeEasingV1 } from "@motionvideo/motion-protocol";

/** Canonical easing union from the protocol (single source of truth). */
export type KeyframeEasing = KeyframeEasingV1;

/** Named (string) easing presets. */
export type NamedEasing = Extract<KeyframeEasing, string>;

/** Cubic-bezier easing parameters. */
export type CubicBezierEasing = Extract<
  KeyframeEasing,
  { type: "cubic-bezier" }
>;

/** Spring easing parameters. */
export type SpringEasing = Extract<KeyframeEasing, { type: "spring" }>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Solve cubic Bézier x(t)=x for t in [0,1] via Newton + bisection (deterministic). */
export function sampleCubicBezier(
  progress: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const x = clamp01(progress);
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const xEst = sampleX(t) - x;
    const d = sampleDX(t);
    if (Math.abs(xEst) < 1e-7 || Math.abs(d) < 1e-7) break;
    t = clamp01(t - xEst / d);
  }

  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 12; i += 1) {
    const xEst = sampleX(t);
    if (Math.abs(xEst - x) < 1e-7) break;
    if (xEst < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** Underdamped / critically-damped-ish spring progress toward 1 (deterministic, finite). */
export function sampleSpring(
  progress: number,
  stiffness: number,
  damping: number,
  mass = 1,
): number {
  const t = clamp01(progress);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const m = Math.max(1e-6, mass);
  const k = Math.max(1e-6, stiffness);
  const c = Math.max(0, damping);
  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  // Map unit progress to a normalized response window.
  const time = t * Math.max(4, 12 / Math.max(0.25, omega0));
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * time);
    const value =
      1 -
      envelope *
        (Math.cos(omegaD * time) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * time));
    return clamp01(value);
  }
  const envelope = Math.exp(-omega0 * time);
  return clamp01(1 - envelope * (1 + omega0 * time));
}

export function sampleNamedEasing(
  progress: number,
  easing: NamedEasing,
): number {
  const value = clamp01(progress);
  switch (easing) {
    case "linear":
      return value;
    case "step":
      return value < 1 ? 0 : 1;
    case "easeIn":
      return value * value;
    case "easeInOut":
      return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
    case "spring":
      return sampleSpring(value, 180, 18, 1);
    case "easeOut":
      return 1 - (1 - value) ** 3;
    default: {
      const neverEasing: never = easing;
      throw new Error(`Unknown runtime easing: ${String(neverEasing)}`);
    }
  }
}

export function sampleEasing(
  progress: number,
  easing: KeyframeEasing | undefined,
): number {
  if (easing === undefined || typeof easing === "string") {
    return sampleNamedEasing(progress, (easing ?? "linear") as NamedEasing);
  }
  if (easing.type === "cubic-bezier") {
    return sampleCubicBezier(
      progress,
      easing.x1,
      easing.y1,
      easing.x2,
      easing.y2,
    );
  }
  if (easing.type === "spring") {
    return sampleSpring(
      progress,
      easing.stiffness,
      easing.damping,
      easing.mass ?? 1,
    );
  }
  throw new Error(`Unknown runtime easing object: ${JSON.stringify(easing)}`);
}

/** Shortest-path angle interpolation in degrees (result normalized to [0, 360)). */
export function interpolateAngle(
  from: number,
  to: number,
  progress: number,
): number {
  let delta = ((to - from + 540) % 360) - 180;
  if (delta < -180) delta += 360;
  const result = from + delta * progress;
  return ((result % 360) + 360) % 360;
}

export function isVec2(
  value: unknown,
): value is { x: number; y: number } | [number, number] {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  )
    return true;
  if (
    value !== null &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value
  ) {
    const v = value as { x: unknown; y: unknown };
    return typeof v.x === "number" && typeof v.y === "number";
  }
  return false;
}

export function asVec2(value: { x: number; y: number } | [number, number]): {
  x: number;
  y: number;
} {
  if (Array.isArray(value)) return { x: value[0], y: value[1] };
  return { x: value.x, y: value.y };
}

export function interpolateVec2(
  from: { x: number; y: number } | [number, number],
  to: { x: number; y: number } | [number, number],
  progress: number,
): { x: number; y: number } {
  const a = asVec2(from);
  const b = asVec2(to);
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
  };
}
