import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";
import type { PaintTextGlyph, RuntimeFrameV3 } from "@motionvideo/motion-runtime";

export type TextPoint = { x: number; y: number };

export function transformTextPoint(layer: V2TextLayer, point: TextPoint): TextPoint {
  const { transform } = layer;
  const radians = (transform.rotate.z * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const localX = point.x - transform.anchor.x;
  const localY = point.y - transform.anchor.y;
  const skewedX = localX + skewX * localY;
  const skewedY = skewY * localX + localY;
  const scaledX = skewedX * transform.scale.x;
  const scaledY = skewedY * transform.scale.y;
  return {
    x: transform.translate.x + transform.anchor.x + scaledX * cos - scaledY * sin,
    y: transform.translate.y + transform.anchor.y + scaledX * sin + scaledY * cos,
  };
}

export function inverseTransformTextPoint(layer: V2TextLayer, point: TextPoint): TextPoint {
  const { transform } = layer;
  const radians = (transform.rotate.z * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const translatedX = point.x - transform.translate.x - transform.anchor.x;
  const translatedY = point.y - transform.translate.y - transform.anchor.y;
  const rotatedX = translatedX * cos + translatedY * sin;
  const rotatedY = -translatedX * sin + translatedY * cos;
  const scaleX = Math.abs(transform.scale.x) < 0.0001 ? 0.0001 : transform.scale.x;
  const scaleY = Math.abs(transform.scale.y) < 0.0001 ? 0.0001 : transform.scale.y;
  const skewedX = rotatedX / scaleX;
  const skewedY = rotatedY / scaleY;
  const determinant = 1 - skewX * skewY;
  const safeDeterminant = Math.abs(determinant) < 0.0001 ? 0.0001 : determinant;
  return {
    x: (skewedX - skewX * skewedY) / safeDeterminant + transform.anchor.x,
    y: (skewedY - skewY * skewedX) / safeDeterminant + transform.anchor.y,
  };
}

export function nearestCaretIndex(
  glyphs: readonly PaintTextGlyph[],
  point: TextPoint,
  textLength: number,
  fallbackWidth: number,
): number {
  if (glyphs.length === 0) {
    return Math.max(0, Math.min(
      textLength,
      Math.round((point.x / Math.max(1, fallbackWidth)) * textLength),
    ));
  }
  const line = [...glyphs].sort((left, right) =>
    Math.abs(point.y - (left.y + left.height / 2)) -
    Math.abs(point.y - (right.y + right.height / 2)),
  )[0];
  if (!line) return textLength;
  const lineCenter = line.y + line.height / 2;
  const lineGlyphs = glyphs
    .filter((glyph) => Math.abs(glyph.y + glyph.height / 2 - lineCenter) <= Math.max(4, glyph.height * 0.5))
    .sort((left, right) => left.x - right.x);
  for (const glyph of lineGlyphs) {
    if (point.x < glyph.x + glyph.width / 2) return glyph.cluster;
  }
  return lineGlyphs.at(-1)?.clusterEnd ?? textLength;
}

export function wordSelection(text: string, index: number): { start: number; end: number } {
  let start = Math.max(0, Math.min(text.length, index));
  let end = start;
  while (start > 0 && !/\s/u.test(text[start - 1] ?? "")) start -= 1;
  while (end < text.length && !/\s/u.test(text[end] ?? "")) end += 1;
  return { start, end };
}

export function textCommandFor(
  frame: RuntimeFrameV3 | null,
  layerId: string,
): Extract<RuntimeFrameV3["commands"][number], { op: "drawText" }> | null {
  const command = frame?.commands.find(
    (candidate) => candidate.op === "drawText" && candidate.layerId === layerId,
  );
  return command?.op === "drawText" ? command : null;
}
