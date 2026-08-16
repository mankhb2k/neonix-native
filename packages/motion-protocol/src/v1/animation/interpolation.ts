/**
 * Interpolation V1 — cứng theo value kind / prop kind.
 * number → linear, color → color, còn lại → step.
 */
export type KeyframeInterpolationV1 = "step" | "linear" | "color";

export function defaultInterpolationForValueKind(
  valueKind: string,
): KeyframeInterpolationV1 {
  if (valueKind === "number" || valueKind === "angle") return "linear";
  if (valueKind === "color") return "color";
  return "step";
}

export function allowedInterpolationsForValueKind(
  valueKind: string,
): ReadonlySet<KeyframeInterpolationV1> {
  if (valueKind === "number" || valueKind === "angle")
    return new Set(["linear"]);
  if (valueKind === "color") return new Set(["color"]);
  return new Set(["step"]);
}
