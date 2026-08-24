/**
 * Toán delta thuần cho move / resize / rotate trong phiên transform stage.
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
  resizeFromCenter = false,
): StageTransformValues {
  const dx = Number.isFinite(pointer.x - pointerStart.x)
    ? pointer.x - pointerStart.x
    : 0;
  const dy = Number.isFinite(pointer.y - pointerStart.y)
    ? pointer.y - pointerStart.y
    : 0;
  const next = { ...base };
  if (handle.includes("e") || handle.includes("w")) {
    const widthDelta = handle.includes("e") ? dx : -dx;
    next.width = Math.max(
      minSize,
      Number.isFinite(base.width + (resizeFromCenter ? widthDelta * 2 : widthDelta))
        ? base.width + (resizeFromCenter ? widthDelta * 2 : widthDelta)
        : minSize,
    );
    if (resizeFromCenter) next.x = base.x - (next.width - base.width) / 2;
    else if (handle.includes("w")) next.x = base.x + (base.width - next.width);
  }
  if (handle.includes("s") || handle.includes("n")) {
    const heightDelta = handle.includes("s") ? dy : -dy;
    next.height = Math.max(
      minSize,
      Number.isFinite(base.height + (resizeFromCenter ? heightDelta * 2 : heightDelta))
        ? base.height + (resizeFromCenter ? heightDelta * 2 : heightDelta)
        : minSize,
    );
    if (resizeFromCenter) next.y = base.y - (next.height - base.height) / 2;
    else if (handle.includes("n")) next.y = base.y + (base.height - next.height);
  }
  return next;
}

export function applyRotateDelta(
  base: StageTransformValues,
  pointerStart: StagePoint,
  pointer: StagePoint,
): StageTransformValues {
  const cx = base.pivotX ?? base.x + base.width / 2;
  const cy = base.pivotY ?? base.y + base.height / 2;
  const startAngle = Math.atan2(pointerStart.y - cy, pointerStart.x - cx);
  const angle = Math.atan2(pointer.y - cy, pointer.x - cx);
  const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
  return {
    ...base,
    rotation: base.rotation + deltaDeg,
  };
}
