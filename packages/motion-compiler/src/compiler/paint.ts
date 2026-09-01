import type { V2Paint, V2PatternContent, V2PaintTransform } from "@motionvideo/motion-protocol";
import type {
  PaintFill,
  PaintPatternContent,
  PaintTransform,
} from "@motionvideo/motion-runtime";

const IDENTITY: PaintTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function transform(value: V2PaintTransform | undefined): PaintTransform {
  return value ? { ...value } : { ...IDENTITY };
}

/** Compose A * B for SVG's affine paint transform convention. */
function multiply(a: PaintTransform, b: PaintTransform): PaintTransform {
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  };
}

function objectBoundingBoxTransform(width: number, height: number, value: V2PaintTransform | undefined): PaintTransform {
  return multiply({ a: width, b: 0, c: 0, d: height, e: 0, f: 0 }, transform(value));
}

function normalizedStop(stop: { offset: number; color: string; stopOpacity?: number }) {
  return {
    offset: Math.min(1, Math.max(0, stop.offset)),
    color: stop.color,
    ...(stop.stopOpacity === undefined ? {} : { stopOpacity: stop.stopOpacity }),
  };
}

function canonicalPatternNode(node: V2PatternContent, width: number, height: number): PaintPatternContent {
  if (node.type === "group") {
    return {
      type: "group",
      ...(node.transform ? { transform: transform(node.transform) } : {}),
      ...(node.opacity === undefined ? {} : { opacity: node.opacity }),
      children: node.children.map((child: V2PatternContent) => canonicalPatternNode(child, width, height)),
    };
  }

  const style = {
    ...(node.fill === undefined ? {} : { fill: canonicalizePaint(node.fill, width, height) }),
    ...(node.fillOpacity === undefined ? {} : { fillOpacity: node.fillOpacity }),
    ...(node.stroke === undefined ? {} : { stroke: canonicalizePaint(node.stroke, width, height) }),
    ...(node.strokeWidth === undefined ? {} : { strokeWidth: node.strokeWidth }),
    ...(node.strokeOpacity === undefined ? {} : { strokeOpacity: node.strokeOpacity }),
  };
  return { ...node, ...style } as PaintPatternContent;
}

function flattenPreviewSafePattern(nodes: PaintPatternContent[]): PaintPatternContent[] {
  const output: PaintPatternContent[] = [];
  for (const node of nodes) {
    if (node.type === "group" && !node.transform && node.opacity === undefined) {
      output.push(...flattenPreviewSafePattern(node.children));
    } else {
      output.push(node);
    }
  }
  return output;
}

/**
 * Compiler phase equivalent to usvg's paint-server normalization.
 * Protocol keeps SVG units; Runtime receives one stable local-space contract.
 */
export function canonicalizePaint(paint: V2Paint | undefined, width: number, height: number): PaintFill | undefined {
  if (paint === undefined) return undefined;
  if (typeof paint === "string") return { type: "solid", color: paint };
  if (paint.type === "none") return { type: "none" };
  if (paint.type === "solid") return { ...paint };

  if (paint.type === "pattern") {
    const patternUnits = paint.patternUnits ?? "objectBoundingBox";
    const patternTransform = paint.patternTransform ?? paint.transform;
    const isObjectBoundingBox = patternUnits === "objectBoundingBox";
    return {
      ...paint,
      x: (paint.x ?? 0) * (isObjectBoundingBox ? width : 1),
      y: (paint.y ?? 0) * (isObjectBoundingBox ? height : 1),
      width: paint.width * (isObjectBoundingBox ? width : 1),
      height: paint.height * (isObjectBoundingBox ? height : 1),
      patternUnits: "userSpaceOnUse",
      patternContentUnits: paint.patternContentUnits ?? "userSpaceOnUse",
      patternTransform: transform(patternTransform),
      content: flattenPreviewSafePattern(paint.content.map((node) => canonicalPatternNode(node, width, height))),
    } as PaintFill;
  }

  const gradientUnits = paint.gradientUnits ?? "objectBoundingBox";
  const gradientTransform =
    gradientUnits === "objectBoundingBox"
      ? objectBoundingBoxTransform(width, height, paint.gradientTransform)
      : transform(paint.gradientTransform);
  const stops = paint.stops.map(normalizedStop);

  if (stops.length === 1) {
    return {
      type: "solid",
      color: stops[0]!.color,
      ...(stops[0]!.stopOpacity === undefined ? {} : { opacity: stops[0]!.stopOpacity }),
    };
  }

  if (paint.type === "linear-gradient") {
    const angle = ((paint.angle ?? 0) * Math.PI) / 180;
    return {
      ...paint,
      x1: paint.x1 ?? (paint.angle === undefined ? 0 : 0.5 - Math.cos(angle) * 0.5),
      y1: paint.y1 ?? (paint.angle === undefined ? 0 : 0.5 - Math.sin(angle) * 0.5),
      x2: paint.x2 ?? (paint.angle === undefined ? 1 : 0.5 + Math.cos(angle) * 0.5),
      y2: paint.y2 ?? (paint.angle === undefined ? 0 : 0.5 + Math.sin(angle) * 0.5),
      gradientUnits: "userSpaceOnUse",
      gradientTransform,
      stops,
    } as PaintFill;
  }

  if (paint.type === "radial-gradient") {
    return {
      ...paint,
      cx: paint.cx ?? 0.5,
      cy: paint.cy ?? 0.5,
      fx: paint.fx ?? paint.cx ?? 0.5,
      fy: paint.fy ?? paint.cy ?? 0.5,
      radius: paint.radius ?? 0.5,
      radiusX: paint.radius ?? 0.5,
      radiusY: paint.radius ?? 0.5,
      fr: paint.fr ?? 0,
      gradientUnits: "userSpaceOnUse",
      gradientTransform,
      stops,
    } as PaintFill;
  }

  return {
    ...paint,
    gradientUnits: "userSpaceOnUse",
    gradientTransform,
    stops,
  } as PaintFill;
}
