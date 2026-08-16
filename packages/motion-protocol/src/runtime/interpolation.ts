/**
 * Derived interpolation — not an authoring JSON field.
 * number/angle → linear, color → color blend, else step.
 */
export type RuntimeKeyframeInterpolation = "step" | "linear" | "color";

export function defaultInterpolationForValueKind(
  valueKind: string,
): RuntimeKeyframeInterpolation {
  if (valueKind === "number" || valueKind === "angle") return "linear";
  if (valueKind === "color") return "color";
  return "step";
}

export function allowedInterpolationsForValueKind(
  valueKind: string,
): ReadonlySet<RuntimeKeyframeInterpolation> {
  if (valueKind === "number" || valueKind === "angle")
    return new Set(["linear"]);
  if (valueKind === "color") return new Set(["color"]);
  return new Set(["step"]);
}
