import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type V2Transform = V2Layer["transform"];

export type AnchorPoint = { x: number; y: number; z: number };
export type TranslatePoint = { x: number; y: number; z: number };

/** Apply the same linear part used by composeLocalMatrix4 to a local vector. */
function applyLinearTransform(transform: V2Transform, point: AnchorPoint): AnchorPoint {
  const scaled = {
    x: transform.scale.x * point.x,
    y: transform.scale.y * point.y,
    z: transform.scale.z * point.z,
  };
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const skewed = {
    x: scaled.x + skewX * scaled.y,
    y: skewY * scaled.x + scaled.y,
    z: scaled.z,
  };
  const rx = (transform.rotate.x * Math.PI) / 180;
  const ry = (transform.rotate.y * Math.PI) / 180;
  const rz = (transform.rotate.z * Math.PI) / 180;
  const xRotated = {
    x: skewed.x,
    y: Math.cos(rx) * skewed.y - Math.sin(rx) * skewed.z,
    z: Math.sin(rx) * skewed.y + Math.cos(rx) * skewed.z,
  };
  const yRotated = {
    x: Math.cos(ry) * xRotated.x + Math.sin(ry) * xRotated.z,
    y: xRotated.y,
    z: -Math.sin(ry) * xRotated.x + Math.cos(ry) * xRotated.z,
  };
  return {
    x: Math.cos(rz) * yRotated.x - Math.sin(rz) * yRotated.y,
    y: Math.sin(rz) * yRotated.x + Math.cos(rz) * yRotated.y,
    z: yRotated.z,
  };
}

/**
 * Change a local anchor while preserving the layer's world-space pivot.
 * The returned translate is the exact inverse compensation for the protocol
 * compose order: T(translate) · R · S · T(-anchor).
 */
export function compensateAnchor(
  transform: V2Transform,
  nextAnchor: AnchorPoint,
): TranslatePoint {
  const delta = {
    x: transform.anchor.x - nextAnchor.x,
    y: transform.anchor.y - nextAnchor.y,
    z: transform.anchor.z - nextAnchor.z,
  };
  const transformedDelta = applyLinearTransform(transform, delta);
  return {
    x: transform.translate.x + delta.x - transformedDelta.x,
    y: transform.translate.y + delta.y - transformedDelta.y,
    z: transform.translate.z + delta.z - transformedDelta.z,
  };
}

