/**
 * Pure move / resize / rotate delta math for stage transform sessions.
 */

import type { StagePoint } from "../coordinates";
import type { ResizeHandle, StageTransformValues } from "../transform-box";

export function applyMoveDelta(
  base: StageTransformValues,
  pointerStart: StagePoint,
  pointer: StagePoint,
): StageTransformValues {
  const dx = pointer.x - pointerStart.x;
  const dy = pointer.y - pointerStart.y;
  return {
    ...base,
    x: base.x + dx,
    y: base.y + dy,
  };
}

export function applyResizeDelta(
  base: StageTransformValues,
  handle: ResizeHandle,
  pointerStart: StagePoint,
  pointer: StagePoint,
  minSize = 8,
): StageTransformValues {
  const dx = pointer.x - pointerStart.x;
  const dy = pointer.y - pointerStart.y;
  const next = { ...base };
  if (handle.includes("e")) {
    next.width = Math.max(minSize, base.width + dx);
  }
  if (handle.includes("s")) {
    next.height = Math.max(minSize, base.height + dy);
  }
  if (handle.includes("w")) {
    next.width = Math.max(minSize, base.width - dx);
    next.x = base.x + (base.width - next.width);
  }
  if (handle.includes("n")) {
    next.height = Math.max(minSize, base.height - dy);
    next.y = base.y + (base.height - next.height);
  }
  return next;
}

export function applyRotateDelta(
  base: StageTransformValues,
  pointerStart: StagePoint,
  pointer: StagePoint,
): StageTransformValues {
  const cx = base.x + base.width / 2;
  const cy = base.y + base.height / 2;
  const startAngle = Math.atan2(pointerStart.y - cy, pointerStart.x - cx);
  const angle = Math.atan2(pointer.y - cy, pointer.x - cx);
  const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
  return {
    ...base,
    rotation: base.rotation + deltaDeg,
  };
}
