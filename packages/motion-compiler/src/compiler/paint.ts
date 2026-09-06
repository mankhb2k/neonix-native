import type { V2Paint, V2PatternContent, V2PaintTransform, V2SvgLength } from "@motionvideo/motion-protocol";
import type {
  PaintFill,
  PaintPatternContent,
  PaintTransform,
} from "@motionvideo/motion-runtime";

const IDENTITY: PaintTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export type PaintServerLookup = ReadonlyMap<string, V2Paint>;

/** Resolve an SVG authoring length at the compiler boundary. */
export function resolveSvgLength(value: V2SvgLength | undefined, reference: number, fontSize = 16): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  switch (value.unit) {
    case "percent": return reference * value.value / 100;
    case "number":
    case "px": return value.value;
    case "pt": return value.value * 96 / 72;
    case "pc": return value.value * 16;
    case "mm": return value.value * 96 / 25.4;
    case "cm": return value.value * 96 / 2.54;
    case "in": return value.value * 96;
    case "em": return value.value * fontSize;
    case "ex": return value.value * fontSize / 2;
  }
}

function paintCoordinate(value: V2SvgLength | undefined, axisSize: number, units: "objectBoundingBox" | "userSpaceOnUse", fallback: number): number {
  if (value === undefined) return fallback;
  if (units === "objectBoundingBox") {
    if (typeof value === "number") return value;
    if (value.unit === "percent") return value.value / 100;
    return (resolveSvgLength(value, axisSize) ?? 0) / Math.max(axisSize, 0.000001);
  }
  return resolveSvgLength(value, axisSize) ?? fallback;
}

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
  const toLocal: PaintTransform = { a: width, b: 0, c: 0, d: height, e: 0, f: 0 };
  const fromLocal: PaintTransform = { a: 1 / Math.max(width, 0.000001), b: 0, c: 0, d: 1 / Math.max(height, 0.000001), e: 0, f: 0 };
  // Coordinates are canonicalized to local pixels below. Conjugating the
  // authoring transform keeps it in that same pixel space instead of scaling
  // already-resolved coordinates a second time.
  return multiply(multiply(toLocal, transform(value)), fromLocal);
}

function localCoordinate(
  value: V2SvgLength | undefined,
  axisSize: number,
  units: "objectBoundingBox" | "userSpaceOnUse",
  fallback: number,
): number {
  const coordinate = paintCoordinate(value, axisSize, units, fallback);
  return units === "objectBoundingBox" ? coordinate * axisSize : coordinate;
}

function localLength(
  value: V2SvgLength | undefined,
  reference: number,
  units: "objectBoundingBox" | "userSpaceOnUse",
  fallback: number,
): number {
  const length = paintCoordinate(value, reference, units, fallback);
  return units === "objectBoundingBox" ? length * reference : length;
}

function normalizedStop(stop: { offset: number; color: string; stopOpacity?: number }, currentColor = "#000000") {
  return {
    offset: Math.min(1, Math.max(0, stop.offset)),
    color: stop.color === "currentColor" ? currentColor : stop.color,
    ...(stop.stopOpacity === undefined ? {} : { stopOpacity: stop.stopOpacity }),
  };
}

function canonicalPatternNode(node: V2PatternContent, width: number, height: number, paintServers?: PaintServerLookup, currentColor = "#000000"): PaintPatternContent {
  if (node.type === "group") {
    return {
      type: "group",
      ...(node.transform ? { transform: transform(node.transform) } : {}),
      ...(node.opacity === undefined ? {} : { opacity: node.opacity }),
      children: node.children.map((child: V2PatternContent) => canonicalPatternNode(child, width, height, paintServers, currentColor)),
    };
  }

  const style = {
    ...(node.fill === undefined ? {} : { fill: canonicalizePaint(node.fill, width, height, paintServers, currentColor) }),
    ...(node.fillOpacity === undefined ? {} : { fillOpacity: node.fillOpacity }),
    ...(node.stroke === undefined ? {} : { stroke: canonicalizePaint(node.stroke, width, height, paintServers, currentColor) }),
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
function resolvePaintReference(paint: V2Paint, paintServers: PaintServerLookup | undefined, seen: Set<string>): V2Paint | undefined {
  if (typeof paint === "string" || !paintServers) return paint;
  if (paint.type === "reference") {
    if (seen.has(paint.id)) return paint.fallback ?? { type: "none" };
    const target = paintServers.get(paint.id);
    if (!target) return paint.fallback ?? { type: "none" };
    const next = new Set(seen);
    next.add(paint.id);
    return resolvePaintReference(target, paintServers, next);
  }
  if (paint.type === "pattern" && paint.href) {
    if (seen.has(paint.href)) return paint;
    const target = paintServers.get(paint.href);
    if (!target || typeof target === "string" || target.type === "none" || target.type === "reference") return paint;
    const next = new Set(seen);
    next.add(paint.href);
    const inherited = resolvePaintReference(target, paintServers, next);
    if (!inherited || typeof inherited === "string" || inherited.type !== "pattern") return paint;
    return { ...inherited, ...paint, width: paint.width ?? inherited.width, height: paint.height ?? inherited.height, content: paint.content ?? inherited.content, href: undefined } as V2Paint;
  }
  if ((paint.type === "linear-gradient" || paint.type === "radial-gradient" || paint.type === "conic-gradient") && paint.href) {
    if (seen.has(paint.href)) return paint;
    const target = paintServers.get(paint.href);
    if (!target || typeof target === "string" || target.type === "none" || target.type === "reference") return paint;
    const next = new Set(seen);
    next.add(paint.href);
    const inherited = resolvePaintReference(target, paintServers, next);
    if (!inherited || typeof inherited === "string" || inherited.type !== paint.type) return paint;
    return { ...inherited, ...paint, stops: paint.stops ?? inherited.stops, href: undefined } as V2Paint;
  }
  return paint;
}

export function canonicalizePaint(
  input: V2Paint | undefined,
  width: number,
  height: number,
  paintServers?: PaintServerLookup,
  currentColor = "#000000",
  contextFill?: V2Paint,
  contextStroke?: V2Paint,
): PaintFill | undefined {
  if (input === undefined) return undefined;
  const paint = resolvePaintReference(input, paintServers, new Set());
  if (paint === undefined) return undefined;
  if (typeof paint === "string") {
    if (paint === "none") return { type: "none" };
    if (paint === "context-fill" || paint === "context-stroke") {
      const context = paint === "context-fill" ? contextFill : contextStroke;
      if (!context || (typeof context === "string" && (context === "context-fill" || context === "context-stroke"))) return { type: "none" };
      return canonicalizePaint(context, width, height, paintServers, currentColor, contextFill, contextStroke);
    }
    return { type: "solid", color: paint === "currentColor" ? currentColor : paint };
  }
  if (paint.type === "reference") return { type: "none" };
  if (paint.type === "none") return { type: "none" };
  if (paint.type === "solid") return { ...paint };

  if (paint.type === "pattern") {
    const patternUnits = paint.patternUnits ?? "objectBoundingBox";
    const patternTransform = paint.patternTransform ?? paint.transform;
    if (paint.width === undefined || paint.height === undefined) {
      throw new Error("SVG pattern requires width and height, directly or through href inheritance");
    }
    return {
      ...paint,
      x: paintCoordinate(paint.x, width, patternUnits, 0),
      y: paintCoordinate(paint.y, height, patternUnits, 0),
      width: paintCoordinate(paint.width, width, patternUnits, 0),
      height: paintCoordinate(paint.height, height, patternUnits, 0),
      patternUnits: "userSpaceOnUse",
      patternContentUnits: paint.patternContentUnits ?? "userSpaceOnUse",
      patternTransform: transform(patternTransform),
      content: flattenPreviewSafePattern((paint.content ?? []).map((node) => canonicalPatternNode(node, width, height, paintServers, currentColor))),
    } as PaintFill;
  }

  const gradientUnits = paint.gradientUnits ?? "objectBoundingBox";
  const gradientTransform =
    gradientUnits === "objectBoundingBox"
      ? objectBoundingBoxTransform(width, height, paint.gradientTransform)
      : transform(paint.gradientTransform);
  const stops = (paint.stops ?? []).map((stop) => normalizedStop(stop, currentColor));

  if (stops.length === 1) {
    return {
      type: "solid",
      color: stops[0]!.color,
      ...(stops[0]!.stopOpacity === undefined ? {} : { opacity: stops[0]!.stopOpacity }),
    };
  }

  if (paint.type === "linear-gradient") {
    const angle = ((paint.angle ?? 0) * Math.PI) / 180;
    const halfLength = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
    const startX = width / 2 - Math.cos(angle) * halfLength;
    const startY = height / 2 - Math.sin(angle) * halfLength;
    const endX = width / 2 + Math.cos(angle) * halfLength;
    const endY = height / 2 + Math.sin(angle) * halfLength;
    return {
      ...paint,
      x1: localCoordinate(paint.x1, width, gradientUnits, paint.angle === undefined ? 0 : gradientUnits === "objectBoundingBox" ? startX / width : startX),
      y1: localCoordinate(paint.y1, height, gradientUnits, paint.angle === undefined ? 0 : gradientUnits === "objectBoundingBox" ? startY / height : startY),
      x2: localCoordinate(paint.x2, width, gradientUnits, paint.angle === undefined ? 1 : gradientUnits === "objectBoundingBox" ? endX / width : endX),
      y2: localCoordinate(paint.y2, height, gradientUnits, paint.angle === undefined ? 0 : gradientUnits === "objectBoundingBox" ? endY / height : endY),
      gradientUnits: "userSpaceOnUse",
      gradientTransform,
      stops,
    } as PaintFill;
  }

  if (paint.type === "radial-gradient") {
    const radius = localLength(paint.radius, Math.min(width, height), gradientUnits, 0.5);
    const radiusX = paint.radiusX === undefined ? radius : localLength(paint.radiusX, width, gradientUnits, 0.5);
    const radiusY = paint.radiusY === undefined ? radius : localLength(paint.radiusY, height, gradientUnits, 0.5);
    return {
      ...paint,
      cx: localCoordinate(paint.cx, width, gradientUnits, 0.5),
      cy: localCoordinate(paint.cy, height, gradientUnits, 0.5),
      fx: localCoordinate(paint.fx ?? paint.cx, width, gradientUnits, 0.5),
      fy: localCoordinate(paint.fy ?? paint.cy, height, gradientUnits, 0.5),
      radius,
      radiusX,
      radiusY,
      fr: localLength(paint.fr, Math.min(width, height), gradientUnits, 0),
      gradientUnits: "userSpaceOnUse",
      gradientTransform,
      stops,
    } as PaintFill;
  }

  return {
    ...paint,
    cx: localCoordinate(paint.cx, width, gradientUnits, 0.5),
    cy: localCoordinate(paint.cy, height, gradientUnits, 0.5),
    gradientUnits: "userSpaceOnUse",
    gradientTransform,
    stops,
  } as PaintFill;
}
