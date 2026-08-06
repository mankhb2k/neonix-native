/** Shared matte evaluation helpers for alpha/luma mask modes (R5). */

export type MatteMode = "clip" | "alpha" | "inverse-alpha" | "luma" | "inverse-luma";

export type MatteSample = {
  /** Coverage in [0,1] after applying mode. */
  coverage: number;
};

/** Deterministic coverage from source alpha and relative luminance. */
export function sampleMatteCoverage(
  mode: MatteMode,
  source: { alpha: number; luma: number },
): MatteSample {
  const alpha = clamp01(source.alpha);
  const luma = clamp01(source.luma);
  switch (mode) {
    case "clip":
    case "alpha":
      return { coverage: alpha };
    case "inverse-alpha":
      return { coverage: 1 - alpha };
    case "luma":
      return { coverage: luma };
    case "inverse-luma":
      return { coverage: 1 - luma };
    default: {
      const neverMode: never = mode;
      throw new Error(`Unknown matte mode: ${String(neverMode)}`);
    }
  }
}

/** Rec. 709 luma from sRGB 0–1 channels. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
