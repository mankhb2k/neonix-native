import type { StageGuide } from "./constraints";
import type { StageBounds } from "./transform-box";

export type StageSnapTarget = {
  id?: string;
  bounds: Pick<StageBounds, "x" | "y" | "width" | "height">;
};

export type StageSnapResult = {
  delta: { x: number; y: number };
  guides: StageGuide[];
};

type AxisCandidate = {
  distance: number;
  delta: number;
  guide: StageGuide;
};

function axisAnchors(bounds: Pick<StageBounds, "x" | "y" | "width" | "height">, axis: "x" | "y") {
  if (axis === "x") {
    return [
      { value: bounds.x, kind: "start" as const },
      { value: bounds.x + bounds.width / 2, kind: "center" as const },
      { value: bounds.x + bounds.width, kind: "end" as const },
    ];
  }
  return [
    { value: bounds.y, kind: "start" as const },
    { value: bounds.y + bounds.height / 2, kind: "center" as const },
    { value: bounds.y + bounds.height, kind: "end" as const },
  ];
}

function bestAxisCandidate(
  moving: Pick<StageBounds, "x" | "y" | "width" | "height">,
  targets: readonly StageSnapTarget[],
  axis: "x" | "y",
  threshold: number,
): AxisCandidate | null {
  const movingAnchors = axisAnchors(moving, axis);
  let best: AxisCandidate | null = null;

  for (const target of targets) {
    const targetAnchors = axisAnchors(target.bounds, axis);
    for (const movingAnchor of movingAnchors) {
      for (const targetAnchor of targetAnchors) {
        const delta = targetAnchor.value - movingAnchor.value;
        const distance = Math.abs(delta);
        if (distance > threshold || (best && distance >= best.distance)) continue;
        const from = axis === "x"
          ? Math.min(moving.y, target.bounds.y)
          : Math.min(moving.x, target.bounds.x);
        const to = axis === "x"
          ? Math.max(moving.y + moving.height, target.bounds.y + target.bounds.height)
          : Math.max(moving.x + moving.width, target.bounds.x + target.bounds.width);
        best = {
          distance,
          delta,
          guide: axis === "x"
            ? { kind: "vline", x: targetAnchor.value, from, to, targetId: target.id }
            : { kind: "hline", y: targetAnchor.value, from, to, targetId: target.id },
        };
      }
    }
  }
  return best;
}

/** Snap the complete selection box to canvas/object edges and centres. */
export function computeSelectionSnap(
  moving: Pick<StageBounds, "x" | "y" | "width" | "height">,
  targets: readonly StageSnapTarget[],
  threshold = 6,
): StageSnapResult {
  const x = bestAxisCandidate(moving, targets, "x", threshold);
  const y = bestAxisCandidate(moving, targets, "y", threshold);
  return {
    delta: { x: x?.delta ?? 0, y: y?.delta ?? 0 },
    guides: [x?.guide, y?.guide].filter((guide): guide is StageGuide => Boolean(guide)),
  };
}
