import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type V2Transform = V2Layer["transform"];
export type AnchorPoint = { x: number; y: number; z: number };
export type TranslatePoint = { x: number; y: number; z: number };
export type LayerBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type AlignmentPatch = { transform: { translate: { x?: number; y?: number } } };

function applyLinearTransform(transform: V2Transform, point: AnchorPoint): AnchorPoint {
  const scaled = { x: transform.scale.x * point.x, y: transform.scale.y * point.y, z: transform.scale.z * point.z };
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const skewed = { x: scaled.x + skewX * scaled.y, y: skewY * scaled.x + scaled.y, z: scaled.z };
  const rx = (transform.rotate.x * Math.PI) / 180;
  const ry = (transform.rotate.y * Math.PI) / 180;
  const rz = (transform.rotate.z * Math.PI) / 180;
  const xRotated = { x: skewed.x, y: Math.cos(rx) * skewed.y - Math.sin(rx) * skewed.z, z: Math.sin(rx) * skewed.y + Math.cos(rx) * skewed.z };
  const yRotated = { x: Math.cos(ry) * xRotated.x + Math.sin(ry) * xRotated.z, y: xRotated.y, z: -Math.sin(ry) * xRotated.x + Math.cos(ry) * xRotated.z };
  return { x: Math.cos(rz) * yRotated.x - Math.sin(rz) * yRotated.y, y: Math.sin(rz) * yRotated.x + Math.cos(rz) * yRotated.y, z: yRotated.z };
}

export function getLayerBounds(layer: V2Layer): LayerBounds {
  const corners = [
    { x: 0, y: 0 }, { x: layer.frame.width, y: 0 },
    { x: 0, y: layer.frame.height }, { x: layer.frame.width, y: layer.frame.height },
  ].map((point) => {
    const transformed = applyLinearTransform(layer.transform, { x: point.x - layer.transform.anchor.x, y: point.y - layer.transform.anchor.y, z: -layer.transform.anchor.z });
    return { x: layer.transform.translate.x + transformed.x, y: layer.transform.translate.y + transformed.y };
  });
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

export function buildAlignmentPatches(
  layers: readonly V2Layer[],
  axis: "horizontal" | "vertical",
  mode: "left" | "center" | "right" | "top" | "middle" | "bottom",
): Record<string, AlignmentPatch> {
  if (layers.length < 2) return {};
  const bounds = layers.map((layer) => ({ layer, bounds: getLayerBounds(layer) }));
  const min = Math.min(...bounds.map(({ bounds: value }) => axis === "horizontal" ? value.minX : value.minY));
  const max = Math.max(...bounds.map(({ bounds: value }) => axis === "horizontal" ? value.maxX : value.maxY));
  const target = mode === "left" || mode === "top" ? min : mode === "right" || mode === "bottom" ? max : (min + max) / 2;
  return Object.fromEntries(bounds.map(({ layer, bounds: value }) => {
    const current = axis === "horizontal"
      ? mode === "left" ? value.minX : mode === "right" ? value.maxX : (value.minX + value.maxX) / 2
      : mode === "top" ? value.minY : mode === "bottom" ? value.maxY : (value.minY + value.maxY) / 2;
    const delta = target - current;
    return [layer.id, axis === "horizontal"
      ? { transform: { translate: { x: layer.transform.translate.x + delta } } }
      : { transform: { translate: { y: layer.transform.translate.y + delta } } }];
  }));
}

export function compensateAnchor(transform: V2Transform, nextAnchor: AnchorPoint): TranslatePoint {
  const delta = { x: transform.anchor.x - nextAnchor.x, y: transform.anchor.y - nextAnchor.y, z: transform.anchor.z - nextAnchor.z };
  const transformedDelta = applyLinearTransform(transform, delta);
  return {
    x: transform.translate.x + delta.x - transformedDelta.x,
    y: transform.translate.y + delta.y - transformedDelta.y,
    z: transform.translate.z + delta.z - transformedDelta.z,
  };
}
