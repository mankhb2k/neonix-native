/**
 * Selection box + hit test handle resize/rotate trong không gian composition.
 */

import type { StagePoint } from "./coordinates";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type StageHandle = ResizeHandle | "rotate";

export type StageTransformValues = {
  rootLayerId: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Composition-space rotation pivot; falls back to the frame center. */
  pivotX?: number;
  pivotY?: number;
};

export type StageBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionBox = StageBounds & { rotation: number };

/** World AABB cho chrome; áp delta authoring lên world base. */
export function selectionBoxFromWorldAndDelta(
  worldBase: StageBounds,
  base: StageTransformValues,
  preview: StageTransformValues,
): SelectionBox {
  return {
    x: worldBase.x + (preview.x - base.x),
    y: worldBase.y + (preview.y - base.y),
    width: Math.max(0, worldBase.width + (preview.width - base.width)),
    height: Math.max(0, worldBase.height + (preview.height - base.height)),
    rotation: preview.rotation,
  };
}

function handleCenters(box: SelectionBox): Record<ResizeHandle, StagePoint> {
  const { x, y, width, height } = box;
  const mx = x + width / 2;
  const my = y + height / 2;
  const right = x + width;
  const bottom = y + height;
  return {
    nw: { x, y },
    n: { x: mx, y },
    ne: { x: right, y },
    e: { x: right, y: my },
    se: { x: right, y: bottom },
    s: { x: mx, y: bottom },
    sw: { x, y: bottom },
    w: { x, y: my },
  };
}

function rotateHandlePoint(box: SelectionBox): StagePoint {
  return {
    x: box.x + box.width / 2,
    y: box.y - 24,
  };
}

/**
 * Ưu tiên handle góc/cạnh; sau đó mới tới nút xoay phía trên box.
 * `handleHitSlop` là bán kính trong không gian composition.
 */
export function hitTestHandle(
  box: SelectionBox,
  compositionPoint: StagePoint,
  handleHitSlop = 8,
): StageHandle | null {
  const centers = handleCenters(box);
  const order: ResizeHandle[] = ["nw", "ne", "se", "sw", "n", "e", "s", "w"];
  const slop2 = handleHitSlop * handleHitSlop;
  for (const h of order) {
    const c = centers[h];
    const dx = compositionPoint.x - c.x;
    const dy = compositionPoint.y - c.y;
    if (dx * dx + dy * dy <= slop2) return h;
  }
  const rot = rotateHandlePoint(box);
  const rdx = compositionPoint.x - rot.x;
  const rdy = compositionPoint.y - rot.y;
  if (rdx * rdx + rdy * rdy <= slop2) return "rotate";
  return null;
}

export function pointInSelectionBox(
  box: SelectionBox,
  point: StagePoint,
): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}
