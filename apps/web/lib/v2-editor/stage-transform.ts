import type { V2Layer } from "@motionvideo/motion-protocol/v2";

export type StagePoint = { x: number; y: number };

export type StageLayerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

const VISUAL_LAYER_TYPES = new Set<V2Layer["type"]>([
  "shape",
  "text",
  "image",
  "video",
  "path",
]);

export function isV2VisualLayer(layer: V2Layer): boolean {
  return VISUAL_LAYER_TYPES.has(layer.type);
}

export function isV2LayerActiveAtTime(layer: V2Layer, time: number): boolean {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const start = layer.timing.start;
  const end = start + layer.timing.duration;
  return safeTime >= start && safeTime <= end;
}

/**
 * Resolve the four frame corners in composition space using the same local
 * transform order as the V2 compiler: translate, anchor, rotate, skew, scale,
 * then the inverse anchor translation.
 */
export function getV2LayerWorldQuad(layer: V2Layer): StagePoint[] {
  const { width, height } = layer.frame;
  const transform = layer.transform;
  const radians = (transform.rotate.z * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  return corners.map((corner) => {
    const localX = corner.x - transform.anchor.x;
    const localY = corner.y - transform.anchor.y;
    const skewedX = localX + skewX * localY;
    const skewedY = skewY * localX + localY;
    const scaledX = skewedX * transform.scale.x;
    const scaledY = skewedY * transform.scale.y;
    return {
      x:
        transform.translate.x +
        transform.anchor.x +
        scaledX * cos -
        scaledY * sin,
      y:
        transform.translate.y +
        transform.anchor.y +
        scaledX * sin +
        scaledY * cos,
    };
  });
}

/** Return the axis-aligned composition bounds used by the selection overlay. */
export function getV2LayerBounds(layer: V2Layer): StageLayerBounds {
  const points = getV2LayerWorldQuad(layer);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    rotation: layer.transform.rotate.z,
  };
}

export function getSelectionBounds(
  bounds: readonly StageLayerBounds[],
): StageLayerBounds | null {
  if (bounds.length === 0) return null;
  const left = Math.min(...bounds.map((bound) => bound.x));
  const top = Math.min(...bounds.map((bound) => bound.y));
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    rotation: bounds.length === 1 ? bounds[0].rotation : 0,
  };
}

export function buildV2MovePatches(
  layers: readonly V2Layer[],
  delta: StagePoint,
): Record<string, { transform: { translate: { x: number; y: number } } }> {
  return Object.fromEntries(
    layers.map((layer) => [
      layer.id,
      {
        transform: {
          translate: {
            x: layer.transform.translate.x + delta.x,
            y: layer.transform.translate.y + delta.y,
          },
        },
      },
    ]),
  );
}

export function buildV2ResizePatch(next: {
  x: number;
  y: number;
  width: number;
  height: number;
}): {
  frame: { width: number; height: number };
  transform: { translate: { x: number; y: number } };
} {
  const finiteOr = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback;
  return {
    frame: {
      width: Math.max(0.001, finiteOr(next.width, 0.001)),
      height: Math.max(0.001, finiteOr(next.height, 0.001)),
    },
    transform: {
      translate: {
        x: finiteOr(next.x, 0),
        y: finiteOr(next.y, 0),
      },
    },
  };
}

export function buildV2RotatePatch(rotation: number): {
  transform: { rotate: { z: number } };
} {
  return {
    transform: {
      rotate: { z: Number.isFinite(rotation) ? rotation : 0 },
    },
  };
}
