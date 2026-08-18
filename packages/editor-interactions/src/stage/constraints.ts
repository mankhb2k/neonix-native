/**
 * Ràng buộc transform trên stage (kích thước tối thiểu, tỷ lệ, snap mép).
 */

import type { StageTransformValues } from "./transform-box";

export type StageGuide =
  | { kind: "vline"; x: number }
  | { kind: "hline"; y: number }
  | { kind: "angle"; degrees: number };

export type StageConstraintInput = {
  minSize?: number;
  lockAspect?: boolean;
  snapEdgesX?: number[];
  snapEdgesY?: number[];
  snapThreshold?: number;
};

const DEFAULT_MIN = 8;

function snapValue(
  value: number,
  edges: readonly number[] | undefined,
  threshold: number,
): { value: number; guide: number | null } {
  if (!edges?.length) return { value, guide: null };
  let best = value;
  let bestDist = threshold;
  let guide: number | null = null;
  for (const edge of edges) {
    const d = Math.abs(value - edge);
    if (d <= bestDist) {
      bestDist = d;
      best = edge;
      guide = edge;
    }
  }
  return { value: best, guide };
}

export function applyMoveConstraints(
  next: StageTransformValues,
  ctx: StageConstraintInput = {},
): { values: StageTransformValues; guides: StageGuide[] } {
  const threshold = ctx.snapThreshold ?? 6;
  const sx = snapValue(next.x, ctx.snapEdgesX, threshold);
  const sy = snapValue(next.y, ctx.snapEdgesY, threshold);
  const guides: StageGuide[] = [];
  if (sx.guide != null) guides.push({ kind: "vline", x: sx.guide });
  if (sy.guide != null) guides.push({ kind: "hline", y: sy.guide });
  return {
    values: { ...next, x: sx.value, y: sy.value },
    guides,
  };
}

export function applyResizeConstraints(
  next: StageTransformValues,
  base: StageTransformValues,
  ctx: StageConstraintInput = {},
): { values: StageTransformValues; guides: StageGuide[] } {
  const minSize = ctx.minSize ?? DEFAULT_MIN;
  let width = Math.max(minSize, next.width);
  let height = Math.max(minSize, next.height);
  let x = next.x;
  let y = next.y;

  if (ctx.lockAspect && base.width > 0 && base.height > 0) {
    const aspect = base.width / base.height;
    if (Math.abs(width - base.width) >= Math.abs(height - base.height)) {
      height = Math.max(minSize, width / aspect);
    } else {
      width = Math.max(minSize, height * aspect);
    }
    // Giữ góc đối diện khi cạnh west/north phát triển từ base.
    if (Math.abs(x - base.x) > 1e-6) {
      x = base.x + base.width - width;
    }
    if (Math.abs(y - base.y) > 1e-6) {
      y = base.y + base.height - height;
    }
  }

  const guides: StageGuide[] = [];
  return {
    values: { ...next, x, y, width, height },
    guides,
  };
}

export function applyRotateConstraints(
  next: StageTransformValues,
  ctx: StageConstraintInput = {},
): { values: StageTransformValues; guides: StageGuide[] } {
  const guides: StageGuide[] = [];
  let rotation = next.rotation;
  // Snap theo bước 15° khi threshold được cung cấp qua snapThreshold.
  const step = 15;
  const threshold = ctx.snapThreshold ?? 0;
  if (threshold > 0) {
    const snapped = Math.round(rotation / step) * step;
    if (Math.abs(snapped - rotation) <= threshold) {
      rotation = snapped;
      guides.push({ kind: "angle", degrees: snapped });
    }
  }
  return { values: { ...next, rotation }, guides };
}
