import {
  multiplyMatrix4,
  composeLocalMatrix4,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
  rotationMatrixX,
  rotationMatrixY,
  rotationMatrixZ,
  translationMatrix3D,
  type Matrix4,
  type RuntimeVisualProjectV3,
  type RuntimeEffect,
  type VisualRuntimeNode,
  type VisualRuntimeText,
  type VisualRuntimeProject,
  type PathContour,
  type PaintFill,
  type PaintOrder,
  type PathMarker,
  type VisualRuntimeMask,
  identityMatrix4,
  interpolatePathContours,
  flattenPathContourAny,
  measureContour,
  tessellateClosedPath,
      tessellatePathStroke,
} from "@motionvideo/motion-runtime";
import {
  parseMotionProtocol,
  type MotionProtocolV2,
  type V2Filter,
  type V2FilterPrimitive,
  type V2Mask,
  type V2MaskLayer,
  type V2Paint,
  type V2SvgLength,
  type V2SvgDefinitionNode,
} from "@motionvideo/motion-protocol";
import { isCompilerFeatureSupported } from "./capabilities";
import { canonicalizePaint, resolveSvgLength, type PaintServerLookup } from "./paint";

const isV2AtomCertified = isCompilerFeatureSupported;
type ShapePayload = Extract<MotionProtocolV2["layers"][number], { type: "shape" }>["payload"];
type ProtocolPaint = Extract<MotionProtocolV2["layers"][number], { type: "shape" }>['style']['fill'];

function runtimePaint(paint: ProtocolPaint | undefined, width: number, height: number, paintServers?: PaintServerLookup, currentColor = "#000000", contextFill?: ProtocolPaint, contextStroke?: ProtocolPaint): PaintFill | undefined {
  return canonicalizePaint(paint, width, height, paintServers, currentColor, contextFill, contextStroke);
}

function resolvePaintColor(paint: ProtocolPaint | undefined, paintServers?: PaintServerLookup, seen = new Set<string>()): ProtocolPaint | undefined {
  if (!paint || typeof paint === "string" || !paintServers) return paint;
  if (paint.type === "reference") {
    if (seen.has(paint.id)) return paint.fallback;
    const target = paintServers.get(paint.id);
    if (!target) return paint.fallback;
    const next = new Set(seen);
    next.add(paint.id);
    return resolvePaintColor(target, paintServers, next);
  }
  return paint;
}

function paintColor(paint: ProtocolPaint | undefined, paintServers?: PaintServerLookup, currentColor = "#000000", contextFill?: ProtocolPaint, contextStroke?: ProtocolPaint): string | undefined {
  paint = resolvePaintColor(paint, paintServers);
  if (typeof paint === "string") {
    if (paint === "none") return "#00000000";
    if (paint === "context-fill" || paint === "context-stroke") {
      const context = paint === "context-fill" ? contextFill : contextStroke;
      if (!context || (typeof context === "string" && (context === "context-fill" || context === "context-stroke"))) return "#00000000";
      return paintColor(context, paintServers, currentColor, contextFill, contextStroke);
    }
    return paint === "currentColor" ? currentColor : paint;
  }
  if (paint?.type === "none") return "#00000000";
  if (paint?.type === "solid") return paint.color;
  if (paint && "stops" in paint) return paint.stops?.[0]?.color ?? "#00000000";
  if (paint?.type === "pattern") {
    const fill = paint.content?.[0] && "fill" in paint.content[0] ? paint.content[0].fill : undefined;
    return typeof fill === "string" ? fill : fill?.type === "solid" ? fill.color : "#00000000";
  }
  return undefined;
}

function strokeReference(width: number, height: number): number {
  return Math.sqrt((width * width + height * height) / 2);
}

function lowerStrokeWidth(value: V2SvgLength | undefined, width: number, height: number, fallback: number): number {
  return resolveSvgLength(value, strokeReference(width, height)) ?? fallback;
}

function lowerStrokeDash(
  dash: { array: "none" | V2SvgLength[]; offset?: V2SvgLength } | undefined,
  width: number,
  height: number,
): { array: number[]; offset: number } | undefined {
  if (!dash || dash.array === "none") return undefined;
  const reference = strokeReference(width, height);
  const array = dash.array.map((value) => resolveSvgLength(value, reference) ?? 0);
  if (array.every((value) => value === 0)) return undefined;
  return { array, offset: resolveSvgLength(dash.offset, reference) ?? 0 };
}

/** SVG closes an open subpath for fill, but a zero-area closure paints nothing. */
function hasFillableRegion(contours: readonly PathContour[]): boolean {
  return contours.some((contour) => {
    const points = flattenPathContourAny(contour).points;
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) > 1e-7;
  });
}

function paintCapability(layerType: "shape" | "path", paint: ProtocolPaint | undefined): string | undefined {
  if (!paint || typeof paint === "string" || paint.type === "solid") return undefined;
  return paint.type === "pattern" ? `${layerType}.pattern` : `${layerType}.gradient`;
}

function primitivePathContour(payload: ShapePayload, width: number, height: number): PathContour {
  const { shape } = payload;
  if (shape === "rectangle") {
    // SVG copies the supplied radius to the missing axis. Explicit zero is
    // preserved, so rx="0" and ry="8" intentionally produce square corners.
    const radiusX = Math.min(resolveSvgLength(payload.rx ?? payload.cornerRadius ?? payload.ry, width) ?? 0, width / 2);
    const radiusY = Math.min(resolveSvgLength(payload.ry ?? payload.cornerRadius ?? payload.rx, height) ?? 0, height / 2);
    if (radiusX > 0 || radiusY > 0) {
      return {
        id: "shape-contour",
        start: { x: radiusX, y: 0 },
        segments: [
          { kind: "line", to: { x: width - radiusX, y: 0 } },
          { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: width, y: radiusY } },
          { kind: "line", to: { x: width, y: height - radiusY } },
          { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: width - radiusX, y: height } },
          { kind: "line", to: { x: radiusX, y: height } },
          { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: 0, y: height - radiusY } },
          { kind: "line", to: { x: 0, y: radiusY } },
          { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: radiusX, y: 0 } },
        ],
        closed: true,
      };
    }
    return {
      id: "shape-contour",
      start: { x: 0, y: 0 },
      segments: [
        { kind: "line", to: { x: width, y: 0 } },
        { kind: "line", to: { x: width, y: height } },
        { kind: "line", to: { x: 0, y: height } },
        { kind: "line", to: { x: 0, y: 0 } },
      ],
      closed: true,
    };
  }
  if (shape === "line") {
    return { id: "shape-contour", start: payload.start!, segments: [{ kind: "line", to: payload.end! }], closed: false };
  }
  if (shape === "polyline" || shape === "polygon") {
    const points = payload.points!;
    return { id: "shape-contour", start: points[0]!, segments: points.slice(1).map((point) => ({ kind: "line" as const, to: point })), closed: shape === "polygon" };
  }
  const radiusX = width / 2;
  const radiusY = height / 2;
  const center = { x: radiusX, y: radiusY };
  return {
    id: "shape-contour",
    start: { x: center.x + radiusX, y: center.y },
    segments: [
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x - radiusX, y: center.y } },
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x + radiusX, y: center.y } },
    ],
    closed: true,
  };
}
/** Protocol V2 stores all authoring time values in milliseconds. */
const MILLISECONDS_TO_SECONDS = 1 / 1000;
const toRuntimeSeconds = (milliseconds: number): number => milliseconds * MILLISECONDS_TO_SECONDS;
type ProtocolLayer = MotionProtocolV2["layers"][number];
type ProtocolEffect = NonNullable<
  ProtocolLayer extends infer Layer
    ? Layer extends { effects?: infer Effects }
      ? Effects
      : never
    : never
>[number];

function viewProjectionMatrix4(project: MotionProtocolV2): {
  worldToClipMatrix: Matrix4;
} {
  const { width, height } = project.composition;
  const view = project.composition.view;
  const viewTranslate = translationMatrix3D(
    -view.transform.translate.x,
    -view.transform.translate.y,
    -view.transform.translate.z,
  );
  const viewRotation = multiplyMatrix4(
    multiplyMatrix4(
      rotationMatrixX(-view.transform.rotate.x),
      rotationMatrixY(-view.transform.rotate.y),
    ),
    rotationMatrixZ(-view.transform.rotate.z),
  );
  const viewMatrix = multiplyMatrix4(viewTranslate, viewRotation);
  const projection = view.projection;
  const projectionMatrix =
    projection?.kind === "perspective"
      ? perspectiveProjectionMatrix(
          width,
          height,
          projection.fov,
          projection.near,
          projection.far,
        )
      : orthographicProjectionMatrix(
          width,
          height,
          projection.zoom,
          projection.near,
          projection.far,
        );
  return {
    worldToClipMatrix: multiplyMatrix4(projectionMatrix, viewMatrix),
  };
}

const DEFAULT_RECTANGLE_STROKE_WIDTH = 4;
const DEFAULT_PATH_STROKE_WIDTH = 1;
const DEFAULT_PAINT_ORDER = ["fill", "stroke", "markers"] as const;

function lowerPaintOrder(
  paintOrder: readonly (typeof DEFAULT_PAINT_ORDER[number])[] | undefined,
): PaintOrder | undefined {
  if (!paintOrder) return undefined;
  return [...new Set([...paintOrder, ...DEFAULT_PAINT_ORDER])];
}

type MarkerPlacement = "start" | "mid" | "end";
type MarkerDefinition = NonNullable<MotionProtocolV2["markers"]>[number];
type MarkerReferenceStyle = {
  markerStart?: string;
  markerMid?: string;
  markerEnd?: string;
  fill?: ProtocolPaint;
  stroke?: ProtocolPaint;
};

function markerSegmentPoint(segment: PathContour["segments"][number]): { x: number; y: number } {
  return segment.to;
}

function markerTangent(
  contour: PathContour,
  segmentIndex: number,
  atEnd: boolean,
): { x: number; y: number } {
  const segment = contour.segments[segmentIndex]!;
  const from = segmentIndex === 0 ? contour.start : markerSegmentPoint(contour.segments[segmentIndex - 1]!);
  const to = segment.to;
  if (segment.kind === "cubic") {
    const control = atEnd ? segment.control2 : segment.control1;
    return atEnd
      ? { x: to.x - control.x, y: to.y - control.y }
      : { x: control.x - from.x, y: control.y - from.y };
  }
  if (segment.kind === "quadratic") {
    const control = segment.control;
    return atEnd
      ? { x: to.x - control.x, y: to.y - control.y }
      : { x: control.x - from.x, y: control.y - from.y };
  }
  return { x: to.x - from.x, y: to.y - from.y };
}

function normalizedDirection(direction: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(direction.x, direction.y);
  return length > 1e-7 ? { x: direction.x / length, y: direction.y / length } : { x: 1, y: 0 };
}

function markerAngle(
  orient: MarkerDefinition["orient"],
  tangent: { x: number; y: number },
  placement: MarkerPlacement,
): number {
  if (typeof orient === "number") return orient;
  const direction = normalizedDirection(tangent);
  const angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  return orient === "auto-start-reverse" && placement === "start" ? angle + 180 : angle;
}

function lowerMarkerContour(
  contour: PathContour,
  marker: MarkerDefinition,
  position: { x: number; y: number },
  angleDegrees: number,
  strokeWidth: number,
  id: string,
): PathContour {
  const radians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const unitScale = marker.markerUnits === "strokeWidth" ? strokeWidth : 1;
  const viewBox = marker.viewBox;
  const scaleX = viewBox ? marker.markerWidth / viewBox.width : 1;
  const scaleY = viewBox ? marker.markerHeight / viewBox.height : 1;
  const transform = (point: { x: number; y: number }) => {
    const localX = ((point.x - (viewBox?.x ?? 0)) * scaleX - marker.refX) * unitScale;
    const localY = ((point.y - (viewBox?.y ?? 0)) * scaleY - marker.refY) * unitScale;
    return {
      x: position.x + cos * localX - sin * localY,
      y: position.y + sin * localX + cos * localY,
    };
  };
  const flattened = flattenPathContourAny(contour);
  const points = flattened.points.map(transform);
  return {
    id,
    start: points[0]!,
    segments: points.slice(1).map((to) => ({ kind: "line" as const, to })),
    closed: flattened.closed,
  };
}

/** Resolve SVG marker references into positioned, backend-neutral geometry. */
function lowerMarkers(
  definitions: readonly MarkerDefinition[] | undefined,
  style: MarkerReferenceStyle,
  contours: PathContour[],
  strokeWidth: number,
  paintServers?: PaintServerLookup,
  currentColor = "#000000",
): PathMarker[] | undefined {
  if (!definitions?.length) return undefined;
  const byId = new Map(definitions.map((marker) => [marker.id, marker]));
  const placements: Array<{
    placement: MarkerPlacement;
    ref: string;
    point: { x: number; y: number };
    tangent: { x: number; y: number };
  }> = [];
  contours.forEach((contour) => {
    if (style.markerStart) {
      placements.push({ placement: "start", ref: style.markerStart, point: contour.start, tangent: markerTangent(contour, 0, false) });
    }
    contour.segments.forEach((segment, segmentIndex) => {
      const last = segmentIndex === contour.segments.length - 1;
      if (!last && style.markerMid) {
        const incoming = normalizedDirection(markerTangent(contour, segmentIndex, true));
        const outgoing = normalizedDirection(markerTangent(contour, segmentIndex + 1, false));
        placements.push({
          placement: "mid",
          ref: style.markerMid,
          point: segment.to,
          tangent: normalizedDirection({ x: incoming.x + outgoing.x, y: incoming.y + outgoing.y }),
        });
      }
      if (last && style.markerEnd) {
        placements.push({ placement: "end", ref: style.markerEnd, point: segment.to, tangent: markerTangent(contour, segmentIndex, true) });
      }
    });
  });
  const result: PathMarker[] = [];
  placements.forEach(({ placement, ref, point, tangent }, placementIndex) => {
    const marker = byId.get(ref);
    if (!marker) return;
    const unitScale = marker.markerUnits === "strokeWidth" ? strokeWidth : 1;
    const angle = markerAngle(marker.orient, tangent, placement);
    const markerContours = marker.content.contours.map((contour, index) =>
      lowerMarkerContour(contour, marker, point, angle, strokeWidth, `${ref}:${placementIndex}:${index}`),
    );
    const fillContours = markerContours.map((contour) => ({ ...contour, closed: true }));
    const markerFill = marker.content.fill;
    const markerStroke = marker.content.stroke;
    const markerStrokeWidth = (marker.content.strokeWidth ?? 1) * unitScale;
    result.push({
      id: `${ref}:${placementIndex}`,
      placement,
      contours: markerContours,
      ...(markerFill !== undefined ? { fill: paintColor(markerFill, paintServers, currentColor, style.fill, style.stroke)!, fillPaint: runtimePaint(markerFill, marker.markerWidth, marker.markerHeight, paintServers, currentColor, style.fill, style.stroke) } : {}),
      ...(marker.content.fillOpacity !== undefined ? { fillOpacity: marker.content.fillOpacity } : {}),
      ...(markerStroke !== undefined ? { stroke: paintColor(markerStroke, paintServers, currentColor, style.fill, style.stroke)!, strokePaint: runtimePaint(markerStroke, marker.markerWidth, marker.markerHeight, paintServers, currentColor, style.fill, style.stroke), strokeWidth: markerStrokeWidth } : {}),
      ...(marker.content.strokeOpacity !== undefined ? { strokeOpacity: marker.content.strokeOpacity } : {}),
      paintOrder: lowerPaintOrder(marker.content.paintOrder) ?? ["fill", "stroke", "markers"],
      ...(markerFill !== undefined ? { mesh: tessellateClosedPath(fillContours, "nonzero") } : {}),
      ...(markerStroke !== undefined ? { strokeMesh: tessellatePathStroke(markerContours, markerStrokeWidth, { join: "miter", cap: "butt" }) } : {}),
    });
  });
  return result.length ? result : undefined;
}

function lowerEffects(
  effects: ProtocolEffect[] | undefined,
): RuntimeEffect[] | undefined {
  if (!effects?.length) return undefined;
  // Preserve authoring order. A later effect always receives the prior result.
  return effects.map((effect) => {
    const capability = effect.type === "blur"
      ? "effect.blur"
      : effect.type === "shadow"
        ? "effect.shadow"
        : effect.type === "outer-glow"
          ? "effect.outer-glow"
          : effect.type === "inner-glow"
            ? "effect.inner-glow"
            : effect.type === "noise"
              ? "effect.noise"
              : effect.type === "color-adjust"
                ? "effect.color-adjust"
                : `effect.${effect.type}`;
    if (!isV2AtomCertified(capability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
    }
    return { ...effect } as RuntimeEffect;
  });
}

function filterResultName(primitive: V2FilterPrimitive, index: number): string {
  return primitive.result ?? `result${index + 1}`;
}

function filterInputName(
  primitive: V2FilterPrimitive,
  index: number,
  primitives: readonly V2FilterPrimitive[],
): string {
  return primitive.in ?? (index === 0 ? "SourceGraphic" : filterResultName(primitives[index - 1]!, index - 1));
}

function isotropicFilterRadius(filter: V2Filter, primitive: V2FilterPrimitive): number {
  if (primitive.type !== "feGaussianBlur" && primitive.type !== "feDropShadow") return 0;
  const deviation = primitive.stdDeviation;
  if (deviation.x !== deviation.y) {
    throw new Error(`SVG filter ${filter.id} requires isotropic stdDeviation for runtime parity: ${primitive.id}`);
  }
  return deviation.x;
}

type SvgGaussianBlur = Extract<V2FilterPrimitive, { type: "feGaussianBlur" }>;
type SvgFlood = Extract<V2FilterPrimitive, { type: "feFlood" }>;
type SvgComposite = Extract<V2FilterPrimitive, { type: "feComposite" }>;
type SvgMerge = Extract<V2FilterPrimitive, { type: "feMerge" }>;

/** Lower the SVG filter graph to the backend-neutral effect program. */
function lowerSvgFilter(filter: V2Filter): RuntimeEffect[] {
  const primitives = filter.primitives;
  const effects: RuntimeEffect[] = [];
  const resultOf = (primitive: V2FilterPrimitive, index: number) => filterResultName(primitive, index);

  const outerGlow = primitives.length === 4
    && primitives[0]?.type === "feGaussianBlur"
    && primitives[1]?.type === "feFlood"
    && primitives[2]?.type === "feComposite"
    && primitives[3]?.type === "feMerge";
  if (outerGlow) {
    const blur = primitives[0] as SvgGaussianBlur;
    const flood = primitives[1] as SvgFlood;
    const composite = primitives[2] as SvgComposite;
    const merge = primitives[3] as SvgMerge;
    if (
      filterInputName(blur, 0, primitives) !== "SourceAlpha" ||
      composite.in !== resultOf(flood, 1) ||
      composite.in2 !== resultOf(blur, 0) ||
      composite.operator !== "in" ||
      merge.nodes.length !== 2 ||
      merge.nodes[0]!.in !== resultOf(composite, 2) ||
      merge.nodes[1]!.in !== "SourceGraphic"
    ) throw new Error(`Unsupported SVG outer glow graph: ${filter.id}`);
    effects.push({ id: filter.id, type: "outer-glow", radius: isotropicFilterRadius(filter, blur), color: flood.color, opacity: flood.opacity ?? 1 });
    return effects;
  }

  const innerGlow = primitives.length === 5
    && primitives[0]?.type === "feGaussianBlur"
    && primitives[1]?.type === "feComposite"
    && primitives[2]?.type === "feFlood"
    && primitives[3]?.type === "feComposite"
    && primitives[4]?.type === "feMerge";
  if (innerGlow) {
    const blur = primitives[0] as SvgGaussianBlur;
    const edge = primitives[1] as SvgComposite;
    const flood = primitives[2] as SvgFlood;
    const tint = primitives[3] as SvgComposite;
    const merge = primitives[4] as SvgMerge;
    if (
      filterInputName(blur, 0, primitives) !== "SourceAlpha" ||
      edge.in !== "SourceAlpha" ||
      edge.in2 !== resultOf(blur, 0) ||
      edge.operator !== "out" ||
      tint.in !== resultOf(flood, 2) ||
      tint.in2 !== resultOf(edge, 1) ||
      tint.operator !== "in" ||
      merge.nodes.length !== 2 ||
      merge.nodes[0]!.in !== resultOf(tint, 3) ||
      merge.nodes[1]!.in !== "SourceGraphic"
    ) throw new Error(`Unsupported SVG inner glow graph: ${filter.id}`);
    effects.push({ id: filter.id, type: "inner-glow", radius: isotropicFilterRadius(filter, blur), color: flood.color, opacity: flood.opacity ?? 1 });
    return effects;
  }

  let previousResult = "SourceGraphic";
  for (const [index, primitive] of primitives.entries()) {
    const input = filterInputName(primitive, index, primitives);
    if (input !== previousResult) {
      throw new Error(`SVG filter ${filter.id} is not a linear runtime graph at primitive ${primitive.id}`);
    }
    const id = `${filter.id}:${primitive.id}`;
    if (primitive.type === "feGaussianBlur") {
      effects.push({ id, type: "blur", radius: isotropicFilterRadius(filter, primitive) });
    } else if (primitive.type === "feDropShadow") {
      effects.push({ id, type: "shadow", source: input === "SourceAlpha" ? "alpha" : "box", offset: { x: primitive.dx, y: primitive.dy }, blur: isotropicFilterRadius(filter, primitive), spread: 0, color: primitive.floodColor, inset: false });
    } else if (primitive.type === "feColorMatrix" && primitive.kind === "saturate") {
      effects.push({ id, type: "color-adjust", brightness: 0, contrast: 1, saturation: primitive.values?.[0] ?? 1, hueRotate: 0, colorInterpolationFilters: primitive.colorInterpolationFilters ?? filter.colorInterpolationFilters });
    } else if (primitive.type === "feColorMatrix" && primitive.kind === "hueRotate") {
      effects.push({ id, type: "color-adjust", brightness: 0, contrast: 1, saturation: 1, hueRotate: primitive.values?.[0] ?? 0, colorInterpolationFilters: primitive.colorInterpolationFilters ?? filter.colorInterpolationFilters });
    } else {
      throw new Error(`SVG filter primitive ${primitive.type} is not executable by the current GPU runtime: ${primitive.id}`);
    }
    previousResult = filterResultName(primitive, index);
  }
  return effects;
}

function lowerLayerEffects(layer: ProtocolLayer, project: MotionProtocolV2): RuntimeEffect[] | undefined {
  const semantic = layer.filter === undefined
    ? undefined
    : lowerSvgFilter(project.filters?.find((filter) => filter.id === layer.filter)
      ?? (() => { throw new Error(`Unknown SVG filter reference: ${layer.filter}`); })());
  const effects = "effects" in layer ? lowerEffects(layer.effects) : undefined;
  if (!semantic) return effects;
  if (!effects) return semantic;
  return [...semantic, ...effects];
}

function lowerBlendMode(layer: ProtocolLayer): VisualRuntimeNode["blendMode"] {
  const blendMode = layer.composite?.blendMode ?? "normal";
  const capability = `composite.blend.${blendMode}`;
  if (!isV2AtomCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
  }
  return blendMode;
}

type Affine2D = [number, number, number, number, number, number];
type DefinitionDrawable = {
  contours: PathContour[];
  fillRule: "nonzero" | "evenodd";
  fill?: string;
  fillPaint?: PaintFill;
  fillOpacity?: number;
  stroke?: string;
  strokePaint?: PaintFill;
  strokeWidth?: number;
  strokeOpacity?: number;
};

const IDENTITY_AFFINE: Affine2D = [1, 0, 0, 1, 0, 0];

function multiplyAffine(left: Affine2D, right: Affine2D): Affine2D {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function affinePoint(matrix: Affine2D, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

function definitionTransformMatrix(
  operations: NonNullable<V2SvgDefinitionNode["transform"]> | undefined,
): Affine2D {
  let matrix = IDENTITY_AFFINE;
  for (const operation of operations ?? []) {
    let next: Affine2D;
    if (operation.type === "translate") next = [1, 0, 0, 1, operation.x, operation.y];
    else if (operation.type === "scale") next = [operation.x, 0, 0, operation.y, 0, 0];
    else if (operation.type === "rotate") {
      const radians = (operation.angle * Math.PI) / 180;
      const rotation: Affine2D = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
      if (operation.center) {
        next = multiplyAffine(
          multiplyAffine([1, 0, 0, 1, operation.center.x, operation.center.y], rotation),
          [1, 0, 0, 1, -operation.center.x, -operation.center.y],
        );
      } else next = rotation;
    } else if (operation.type === "skewX") {
      next = [1, 0, Math.tan((operation.angle * Math.PI) / 180), 1, 0, 0];
    } else if (operation.type === "skewY") {
      next = [1, Math.tan((operation.angle * Math.PI) / 180), 0, 1, 0, 0];
    } else {
      next = operation.values;
    }
    matrix = multiplyAffine(matrix, next);
  }
  return matrix;
}

function transformContour(contour: PathContour, matrix: Affine2D): PathContour {
  const point = (value: { x: number; y: number }) => affinePoint(matrix, value);
  return {
    ...contour,
    start: point(contour.start),
    segments: contour.segments.map((segment) => {
      if (segment.kind === "line") return { ...segment, to: point(segment.to) };
      if (segment.kind === "quadratic") return { ...segment, control: point(segment.control), to: point(segment.to) };
      if (segment.kind === "cubic") return { ...segment, control1: point(segment.control1), control2: point(segment.control2), to: point(segment.to) };
      return { ...segment, radii: { x: segment.radii.x, y: segment.radii.y }, to: point(segment.to) };
    }),
  };
}

function definitionRectContour(x: number, y: number, width: number, height: number, rx = 0, ry = rx): PathContour {
  const radiusX = Math.min(Math.max(0, rx), width / 2);
  const radiusY = Math.min(Math.max(0, ry), height / 2);
  if (radiusX === 0 && radiusY === 0) {
    return {
      id: "definition-rect",
      start: { x, y },
      segments: [
        { kind: "line", to: { x: x + width, y } },
        { kind: "line", to: { x: x + width, y: y + height } },
        { kind: "line", to: { x, y: y + height } },
      ],
      closed: true,
    };
  }
  return {
    id: "definition-rounded-rect",
    start: { x: x + radiusX, y },
    segments: [
      { kind: "line", to: { x: x + width - radiusX, y } },
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: x + width, y: y + radiusY } },
      { kind: "line", to: { x: x + width, y: y + height - radiusY } },
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: x + width - radiusX, y: y + height } },
      { kind: "line", to: { x: x + radiusX, y: y + height } },
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x, y: y + height - radiusY } },
      { kind: "line", to: { x, y: y + radiusY } },
      { kind: "arc", radii: { x: radiusX, y: radiusY }, rotation: 0, largeArc: false, sweep: true, to: { x: x + radiusX, y } },
    ],
    closed: true,
  };
}

function definitionNodeContour(node: V2SvgDefinitionNode): PathContour | undefined {
  if (node.type === "path") return undefined;
  if (node.type === "rect") return definitionRectContour(node.x, node.y, node.width, node.height, node.rx, node.ry);
  if (node.type === "circle") return definitionRectContour(node.cx - node.r, node.cy - node.r, node.r * 2, node.r * 2, node.r, node.r);
  if (node.type === "ellipse") return definitionRectContour(node.cx - node.rx, node.cy - node.ry, node.rx * 2, node.ry * 2, node.rx, node.ry);
  if (node.type === "line") return { id: "definition-line", start: { x: node.x1, y: node.y1 }, segments: [{ kind: "line", to: { x: node.x2, y: node.y2 } }], closed: false };
  if (node.type === "polyline") return { id: "definition-polyline", start: node.points[0]!, segments: node.points.slice(1).map((to) => ({ kind: "line" as const, to })), closed: false };
  if (node.type === "polygon") return { id: "definition-polygon", start: node.points[0]!, segments: node.points.slice(1).map((to) => ({ kind: "line" as const, to })), closed: true };
  return undefined;
}

function lowerDefinitionDrawables(
  nodes: readonly V2SvgDefinitionNode[],
  inherited: Affine2D,
  mask: V2Mask,
  targetWidth: number,
  targetHeight: number,
  paintServers?: PaintServerLookup,
): DefinitionDrawable[] {
  const unitMatrix: Affine2D = mask.maskContentUnits === "objectBoundingBox"
    ? [targetWidth, 0, 0, targetHeight, 0, 0]
    : IDENTITY_AFFINE;
  const rootMatrix = multiplyAffine(
    inherited,
    multiplyAffine(unitMatrix, definitionTransformMatrix(mask.transform)),
  );
  const visit = (node: V2SvgDefinitionNode, parentMatrix: Affine2D, parentOpacity: number): DefinitionDrawable[] => {
    const matrix = multiplyAffine(parentMatrix, definitionTransformMatrix(node.transform));
    const opacity = parentOpacity * (node.type === "group" ? node.opacity ?? 1 : 1);
    if (node.type === "group") return node.children.flatMap((child) => visit(child, matrix, opacity));
    const rawContour = node.type === "path"
      ? undefined
      : definitionNodeContour(node);
    const contours = node.type === "path"
      ? node.contours.map((contour) => transformContour(contour, matrix))
      : rawContour
        ? [transformContour(rawContour, matrix)]
        : [];
    if (contours.length === 0) return [];
    const fill = node.fill === undefined ? undefined : paintColor(node.fill, paintServers);
    const stroke = node.stroke === undefined ? undefined : paintColor(node.stroke, paintServers);
    return [{
      contours,
      fillRule: node.type === "path" ? node.fillRule ?? "nonzero" : "nonzero",
      ...(fill ? { fill, fillPaint: runtimePaint(node.fill, targetWidth, targetHeight, paintServers) } : {}),
      ...(node.fillOpacity !== undefined ? { fillOpacity: node.fillOpacity * opacity } : {}),
      ...(stroke ? { stroke, strokePaint: runtimePaint(node.stroke, targetWidth, targetHeight, paintServers) } : {}),
      ...(node.strokeWidth !== undefined ? { strokeWidth: node.strokeWidth } : {}),
      ...(node.strokeOpacity !== undefined ? { strokeOpacity: node.strokeOpacity * opacity } : {}),
    }];
  };
  return nodes.flatMap((node) => visit(node, rootMatrix, 1));
}

function lowerSemanticMask(
  layer: ProtocolLayer,
  project: MotionProtocolV2,
  context: LayerContext,
  paintServers?: PaintServerLookup,
): { clipPath?: NonNullable<VisualRuntimeNode["clipPath"]>; mask?: VisualRuntimeMask; nodes: VisualRuntimeNode[] } {
  const maskLayers: V2MaskLayer[] = layer.maskLayers
    ?? (layer.mask !== undefined ? [{ maskIds: [layer.mask], composite: "add" as const }] : []);
  if (layer.clipPath === undefined && maskLayers.length === 0) return { nodes: [] };
  const nodes: VisualRuntimeNode[] = [];
  const compileMaskLayers = (): { mask: VisualRuntimeMask; nodes: VisualRuntimeNode[] } => {
    const runtimeLayers: NonNullable<VisualRuntimeMask["layers"]> = [];
    for (const [layerIndex, maskLayer] of maskLayers.entries()) {
      const sourceIds: string[] = [];
      if (!isV2AtomCertified(`mask.composite.${maskLayer.composite}`)) throw new Error(`Uncertified Protocol V2 atom: mask.composite.${maskLayer.composite}`);
      for (const maskId of maskLayer.maskIds) {
        const definition = project.masks?.find((candidate) => candidate.id === maskId);
        if (!definition) throw new Error(`Unknown mask reference: ${maskId}`);
        if (!isV2AtomCertified("mask.definition")) throw new Error("Uncertified Protocol V2 atom: mask.definition");
        if (definition.maskUnits === "objectBoundingBox" && !isV2AtomCertified("mask.objectBoundingBox")) {
          throw new Error("Uncertified Protocol V2 atom: mask.objectBoundingBox");
        }
        if (definition.image) {
          if (!isV2AtomCertified("mask.image")) throw new Error("Uncertified Protocol V2 atom: mask.image");
          const sourceId = `${layer.id}:mask:${maskId}:image`;
          sourceIds.push(sourceId);
          nodes.push({
            id: sourceId,
            parentId: layer.id,
            order: -1,
            timing: context.timing,
            opacity: 1,
            blendMode: "normal",
            visible: context.visible,
            localMatrix: identityMatrix4(),
            worldMatrix: context.worldMatrix,
            content: {
              kind: "image",
              assetId: definition.image.assetId,
              x: definition.image.x,
              y: definition.image.y,
              width: definition.image.width,
              height: definition.image.height,
              fit: definition.image.fit,
              ...(definition.image.preserveAspectRatio ? { preserveAspectRatio: definition.image.preserveAspectRatio } : {}),
            },
          });
          continue;
        }
        const drawables = lowerDefinitionDrawables(definition.children ?? [], IDENTITY_AFFINE, definition, layer.frame.width, layer.frame.height, paintServers);
        for (const [drawableIndex, drawable] of drawables.entries()) {
          const sourceId = `${layer.id}:mask:${maskId}:${drawableIndex}`;
          sourceIds.push(sourceId);
          nodes.push(definitionRuntimeNode(layer, context, drawable, sourceId, false));
        }
      }
      if (sourceIds.length === 0) throw new Error(`mask layer ${layerIndex} has no renderable source`);
      const firstDefinition = project.masks?.find((candidate) => candidate.id === maskLayer.maskIds[0]);
      const mode = maskLayer.mode === "alpha" || (maskLayer.mode === undefined && firstDefinition?.maskType === "alpha") ? "alpha" as const : "luma" as const;
      if (mode === "luma" && !isV2AtomCertified("mask.luminance")) throw new Error("Uncertified Protocol V2 atom: mask.luminance");
      runtimeLayers.push({ mode, sourceIds, composite: maskLayer.composite });
    }
    const first = runtimeLayers[0]!;
    return {
      mask: {
        mode: first.mode,
        sourceId: first.sourceIds[0]!,
        sourceIds: first.sourceIds,
        layers: runtimeLayers,
      },
      nodes,
    };
  };
  if (layer.clipPath !== undefined) {
    if (!isV2AtomCertified("clipPath.definition")) throw new Error("Uncertified Protocol V2 atom: clipPath.definition");
    const definition = project.clipPaths?.find((candidate) => candidate.id === layer.clipPath);
    if (!definition) throw new Error(`Unknown clipPath reference: ${layer.clipPath}`);
    if (definition.clipPathUnits === "objectBoundingBox" && !isV2AtomCertified("clipPath.objectBoundingBox")) {
      throw new Error("Uncertified Protocol V2 atom: clipPath.objectBoundingBox");
    }
    const maskDefinition = { ...definition, maskContentUnits: "userSpaceOnUse" as const } as unknown as V2Mask;
    const objectBoxMatrix: Affine2D = definition.clipPathUnits === "objectBoundingBox"
      ? [layer.frame.width, 0, 0, layer.frame.height, 0, 0]
      : IDENTITY_AFFINE;
    const drawables = lowerDefinitionDrawables(definition.children, objectBoxMatrix, maskDefinition, layer.frame.width, layer.frame.height, paintServers);
    const sourceIds = drawables.map((_, index) => `${layer.id}:clipPath:${definition.id}:${index}`);
    const clipNodes = drawables.map((drawable, index) => definitionRuntimeNode(layer, context, drawable, sourceIds[index]!, true));
    if (!clipNodes.length) throw new Error(`clipPath ${definition.id} has no renderable geometry`);
    const clipPath = { sourceId: sourceIds[0]!, sourceIds };
    if (maskLayers.length === 0) return { clipPath, nodes: clipNodes };
    const loweredMask = compileMaskLayers();
    return { clipPath, mask: loweredMask.mask, nodes: [...clipNodes, ...loweredMask.nodes] };
  }
  const loweredMask = compileMaskLayers();
  return { mask: loweredMask.mask, nodes: loweredMask.nodes };
}

function definitionRuntimeNode(
  target: ProtocolLayer,
  context: LayerContext,
  drawable: DefinitionDrawable,
  id: string,
  clip: boolean,
): VisualRuntimeNode {
  const hasFillableContour = drawable.contours.some((contour) => contour.closed && contour.segments.length >= 2);
  const fill = clip
    ? hasFillableContour ? "#ffffff" : undefined
    : drawable.fill ?? (!drawable.stroke && hasFillableContour ? "#000000" : undefined);
  const fillPaint = clip ? undefined : drawable.fillPaint;
  const stroke = clip ? undefined : drawable.stroke;
  const strokePaint = clip ? undefined : drawable.strokePaint;
  const strokeWidth = clip ? undefined : drawable.strokeWidth;
  const fillOpacity = clip ? 1 : drawable.fillOpacity;
  const strokeOpacity = clip ? undefined : drawable.strokeOpacity;
  const mesh = fill ? tessellateClosedPath(drawable.contours, drawable.fillRule) : undefined;
  const strokeMesh = stroke && strokeWidth
    ? tessellatePathStroke(drawable.contours, strokeWidth, { join: "miter", cap: "butt" })
    : undefined;
  return {
    id,
    parentId: target.id,
    order: -1,
    timing: context.timing,
    opacity: 1,
    blendMode: "normal",
    visible: context.visible,
    localMatrix: identityMatrix4(),
    worldMatrix: context.worldMatrix,
    content: {
      kind: "path",
      width: target.frame.width,
      height: target.frame.height,
      contours: drawable.contours,
      fillRule: drawable.fillRule,
      ...(fill ? { fill, ...(fillPaint ? { fillPaint } : {}), fillOpacity, ...(mesh ? { mesh } : {}) } : {}),
      ...(stroke && strokeWidth ? { stroke, ...(strokePaint ? { strokePaint } : {}), strokeWidth, ...(strokeOpacity !== undefined ? { strokeOpacity } : {}), ...(strokeMesh ? { strokeMesh } : {}) } : {}),
    },
  };
}

type LayerContext = {
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  opacity: number;
  visible: boolean;
  timing: { start: number; duration: number };
  currentColor: string;
};

/** Options accepted by the canonical Protocol compiler. */
export type CompileProtocolOptions = Record<string, never>;
/** Internal certified visual lowering used by the Runtime V3 compiler. */
function compileVisualRuntimeInternal(
  input: unknown,
  _options: CompileProtocolOptions = {},
): VisualRuntimeProject {
  const project = parseMotionProtocol(input);
  const paintServers = new Map<string, V2Paint>((project.paintServers ?? []).map((definition) => [definition.id, definition.paint]));
  const projection = viewProjectionMatrix4(project);
  const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
  const contextCache = new Map<string, LayerContext>();
  const semanticMaskNodes: VisualRuntimeNode[] = [];

  const resolveLayerContext = (layer: MotionProtocolV2["layers"][number]): LayerContext => {
    const cached = contextCache.get(layer.id);
    if (cached) return cached;
    const localMatrix = composeLocalMatrix4(layer.transform);
    const parent = layer.parentLayerId === null ? null : layerById.get(layer.parentLayerId) ?? null;
    const parentContext = parent
      ? resolveLayerContext(parent)
      : {
          localMatrix: identityMatrix4(),
          worldMatrix: identityMatrix4(),
          opacity: 1,
        visible: true,
        timing: { start: 0, duration: Number.POSITIVE_INFINITY },
        currentColor: "#000000",
        };
    const start = parentContext.timing.start + toRuntimeSeconds(layer.timing.start);
    const end = Math.min(
      parentContext.timing.start + parentContext.timing.duration,
      start + toRuntimeSeconds(layer.timing.duration),
    );
    const context: LayerContext = {
      localMatrix,
      worldMatrix: multiplyMatrix4(parentContext.worldMatrix, localMatrix),
      // Group opacity is deliberately not folded into child alpha. Runtime
      // preserves group nodes so it can flatten their subtree and apply that
      // alpha exactly once at the compositing boundary.
      opacity: layer.opacity,
      visible:
        parentContext.visible &&
        layer.enabled !== false &&
        (layer.visibility ?? "visible") === "visible" &&
        layer.opacity > 0 &&
        end > start,
      timing: { start, duration: Math.max(0, end - start) },
      currentColor: layer.color ?? parentContext.currentColor,
    };
    contextCache.set(layer.id, context);
    return context;
  };

  const compiledLayerNodes = project.layers.map((layer): VisualRuntimeNode | null => {
    const context = resolveLayerContext(layer);
    for (const capability of [
      ...(layer.enabled !== undefined ? ["layer.enabled"] : []),
      ...(layer.visibility !== undefined ? ["layer.visibility"] : []),
      ...(layer.backfaceVisibility !== undefined ? ["layer.backfaceVisibility"] : []),
      ...(layer.filter !== undefined ? ["filter.svg.graph"] : []),
    ]) {
      if (!isV2AtomCertified(capability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
      }
    }
    if (layer.type === "group" && layer.render3d) {
      for (const capability of [
        "group.render3d.transformStyle",
        ...(layer.render3d.perspective ? ["group.render3d.perspective"] : []),
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
    }
    const blendMode = lowerBlendMode(layer);
    const isolation = layer.composite?.isolation;
    const groupEffects = layer.type === "group" ? lowerLayerEffects(layer, project) : undefined;
    const semanticMask = lowerSemanticMask(layer, project, context, paintServers);
    semanticMaskNodes.push(...semanticMask.nodes);
    const semanticState = {
      ...(semanticMask.clipPath ? { clipPath: semanticMask.clipPath } : {}),
      ...(semanticMask.mask ? { mask: semanticMask.mask } : {}),
    };
    if (layer.type === "group") {
      for (const capability of [
        "group.transform",
        "group.timing",
        "group.opacity",
        "group.order",
        ...(layer.effects ? ["group.effects"] : []),
        ...(isolation ? ["group.isolation"] : []),
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      if (context.timing.duration <= 0) return null;
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        ...semanticState,
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "group",
          width: layer.frame.width,
          height: layer.frame.height,
          ...(groupEffects ? { effects: groupEffects } : {}),
          ...(layer.render3d ? { render3d: layer.render3d } : {}),
        },
      };
    }
    if (context.timing.duration <= 0) return null;
    if (layer.type === "image") {
      for (const capability of [
        "image.transform",
        "image.timing",
        "image.opacity",
        "image.order",
        "image.asset",
        "image.viewport",
        "image.fit",
        "image.preserveAspectRatio",
        "image.imageRendering",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === layer.payload.assetId);
      if (asset && asset.kind !== "image") {
        throw new Error(`Protocol V2 image layer ${layer.id} references a non-image asset`);
      }
      const effects = lowerLayerEffects(layer, project);
      const imageAsset = asset?.kind === "image" ? asset : undefined;
      const intrinsicWidth = imageAsset?.width ?? layer.frame.width;
      const intrinsicHeight = imageAsset?.height ?? layer.frame.height;
      const width = layer.payload.width
        ?? (layer.payload.height !== undefined && imageAsset?.width && imageAsset.height
          ? layer.payload.height * imageAsset.width / imageAsset.height
          : intrinsicWidth);
      const height = layer.payload.height
        ?? (layer.payload.width !== undefined && imageAsset?.width && imageAsset.height
          ? layer.payload.width * imageAsset.height / imageAsset.width
          : intrinsicHeight);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        ...semanticState,
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "image" as const,
          assetId: layer.payload.assetId,
          ...(asset?.uri ? { uri: asset.uri } : {}),
          x: layer.payload.x ?? 0,
          y: layer.payload.y ?? 0,
          width,
          height,
          ...(layer.payload.fit ? { fit: layer.payload.fit } : {}),
          ...(layer.payload.preserveAspectRatio ? { preserveAspectRatio: layer.payload.preserveAspectRatio } : {}),
          ...(layer.payload.imageRendering ? { imageRendering: layer.payload.imageRendering } : {}),
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "video") {
      for (const capability of [
        "video.transform",
        "video.timing",
        "video.opacity",
        "video.order",
        "video.asset",
        "video.fit",
        "video.trim",
        "video.framePolicy",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === layer.payload.assetId);
      if (asset?.kind !== undefined && asset.kind !== "video") {
        throw new Error(`Protocol V2 video layer ${layer.id} references a non-video asset`);
      }
      const sourceFps = asset?.kind === "video" && asset.fps !== undefined
        ? asset.fps
        : project.composition.fps;
      const effects = lowerLayerEffects(layer, project);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        ...semanticState,
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "video" as const,
          assetId: layer.payload.assetId,
          ...(asset?.uri ? { uri: asset.uri } : {}),
          width: layer.frame.width,
          height: layer.frame.height,
          ...(layer.payload.fit ? { fit: layer.payload.fit } : {}),
          trimStart: toRuntimeSeconds(layer.payload.trimStart ?? 0),
          ...(layer.payload.trimEnd !== undefined
            ? { trimEnd: toRuntimeSeconds(layer.payload.trimEnd) }
            : asset?.kind === "video" && asset.duration !== undefined
              ? { trimEnd: toRuntimeSeconds(asset.duration) }
              : {}),
          ...(asset?.kind === "video" && asset.duration !== undefined
            ? { sourceDuration: toRuntimeSeconds(asset.duration) }
            : {}),
          sourceFps,
          // Native video audio is never an output path. Embedded audio is
          // Embedded audio is lowered by the canonical Runtime V3 compiler.
          muted: true,
          framePolicy: layer.payload.framePolicy ?? "floor",
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "text") {
      const firstChunk = layer.payload.chunks[0]!;
      const firstSpan = firstChunk.spans[0]!;
      const sourceText = layer.payload.source.text;
      const fontSize = resolveSvgLength(firstSpan.font.size, layer.frame.width, 16) ?? 16;
      const resolvedFontAssetIds = firstSpan.resolvedFontAssetIds ?? [];
      const resolvedFontAssets = resolvedFontAssetIds
        .map((assetId) => project.assets?.find((candidate) => candidate.id === assetId))
        .filter((candidate): candidate is Extract<NonNullable<typeof project.assets>[number], { kind: "font" }> => candidate?.kind === "font");
      const textFontAsset = resolvedFontAssets[0];
      if (!textFontAsset) {
        throw new Error(`Protocol V2 text layer ${layer.id} has no resolved font asset for family ${firstSpan.font.families[0]}`);
      }
      const textLineHeight = layer.payload.layout?.lineHeight ?? fontSize * 1.2;
      const layoutTextAlign = layer.payload.layout?.textAlign;
      const textFontFallbacks = resolvedFontAssets;
      const textAlign = firstChunk.textAnchor === "middle"
        ? "center" as const
        : firstChunk.textAnchor === "end"
          ? "right" as const
          : "left" as const;
      const justify = layoutTextAlign === "justify" ? "line" as const : layoutTextAlign === "justify-all" ? "all" as const : undefined;
      const letterSpacing = firstSpan.letterSpacing === "normal"
        ? 0
        : resolveSvgLength(firstSpan.letterSpacing, layer.frame.width, fontSize) ?? 0;
      const wordSpacing = firstSpan.wordSpacing === "normal"
        ? 0
        : resolveSvgLength(firstSpan.wordSpacing, layer.frame.width, fontSize) ?? 0;
      const textLength = resolveSvgLength(firstSpan.textLength, layer.frame.width, fontSize);
      const textPathDefinition = firstChunk.textPath
        ? layerById.get(firstChunk.textPath.pathId)
        : undefined;
      const textPathContours = textPathDefinition?.type === "path"
        ? textPathDefinition.payload.contours
        : undefined;
      const textPathLength = textPathContours?.reduce(
        (total, contour) => total + measureContour(flattenPathContourAny(contour)).length,
        0,
      ) ?? 0;
      const textPathStartOffset = firstChunk.textPath
        ? resolveSvgLength(firstChunk.textPath.startOffset, textPathLength, fontSize) ?? 0
        : undefined;
      const textDecoration = firstSpan.textDecoration
        ? Object.fromEntries(
            Object.entries(firstSpan.textDecoration).map(([name, style]) => {
              if (!style) return [name, undefined];
              const paint = style.fill ?? style.stroke;
              const fill = paintColor(paint, paintServers, context.currentColor) ?? "#000000";
              const fillPaint = runtimePaint(paint, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
              const thickness = resolveSvgLength(style.strokeWidth, fontSize, fontSize) ?? Math.max(1, fontSize / 16);
              return [name, { fill, ...(fillPaint ? { fillPaint } : {}), thickness }];
            }),
          ) as VisualRuntimeText["textDecoration"]
        : undefined;
      const stroke = paintColor(firstSpan.stroke, paintServers, context.currentColor);
      const strokePaint = runtimePaint(firstSpan.stroke, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
      const strokeWidth = resolveSvgLength(firstSpan.strokeWidth, layer.frame.width, fontSize);
      for (const capability of [
        "text.transform",
        "text.timing",
        "text.opacity",
        "text.order",
        "text.font",
        ...(layer.payload.source.textRendering && layer.payload.source.textRendering !== "auto" ? ["text.rendering"] : []),
        sourceText.includes("\n") ? "text.layout.multiline" : "text.layout.singleLine",
        "text.layout.glyphs",
        ...(layer.payload.layout?.textOverflow === "ellipsis" || layer.clipPath ? ["text.layout.overflow"] : []),
        "text.fill",
        ...(textLength !== undefined ? ["text.length"] : []),
        ...((firstChunk.dx || firstChunk.dy || firstChunk.rotate) ? ["text.positioning"] : []),
        ...(textPathContours ? ["text.textPath"] : []),
        ...((layer.payload.source.writingMode === "vertical-rl" || layer.payload.source.writingMode === "vertical-lr") ? ["text.writingMode.vertical"] : []),
        ...(textDecoration ? ["text.decoration"] : []),
        ...((stroke && stroke !== "#00000000" && strokeWidth !== undefined) ? ["text.stroke"] : []),
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const effects = lowerLayerEffects(layer, project);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        ...semanticState,
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "text" as const,
          text: sourceText,
          fontAssetId: textFontAsset.id,
          fontUri: textFontAsset.uri,
          fontIntegrity: textFontAsset.integrity ?? "",
          ...(firstSpan.font.weight === undefined ? {} : { fontWeight: firstSpan.font.weight }),
          ...(firstSpan.font.style === undefined ? {} : { fontStyle: firstSpan.font.style }),
          ...(firstSpan.font.stretch === undefined ? {} : { fontStretch: firstSpan.font.stretch }),
          ...(firstSpan.font.variations ? { variations: { ...firstSpan.font.variations } } : {}),
          ...(textFontFallbacks.length > 1
            ? { fontFallbacks: textFontFallbacks.map((candidate) => ({ assetId: candidate.id, uri: candidate.uri, integrity: candidate.integrity ?? "" })) }
            : {}),
          fontSize,
          lineHeight: textLineHeight,
          letterSpacing,
          ...(justify ? { justify } : {}),
          whiteSpace: layer.payload.layout?.whiteSpace ?? "normal",
          ...(layer.payload.source.textRendering ? { textRendering: layer.payload.source.textRendering } : {}),
          ...(layer.payload.layout?.textOverflow ? { textOverflow: layer.payload.layout.textOverflow } : {}),
          ...(layer.payload.layout?.maxLines === undefined ? {} : { maxLines: layer.payload.layout.maxLines }),
          ...(wordSpacing ? { wordSpacing } : {}),
          ...(textLength !== undefined ? { textLength, lengthAdjust: firstSpan.lengthAdjust ?? "spacing" } : {}),
          ...(firstChunk.dx ? { dx: firstChunk.dx.map((value) => resolveSvgLength(value, layer.frame.width, fontSize) ?? 0) } : {}),
          ...(firstChunk.dy ? { dy: firstChunk.dy.map((value) => resolveSvgLength(value, layer.frame.height, fontSize) ?? 0) } : {}),
          ...(firstChunk.rotate ? { rotate: [...firstChunk.rotate] } : {}),
          ...(firstSpan.dominantBaseline ? { dominantBaseline: firstSpan.dominantBaseline } : {}),
          ...(firstSpan.alignmentBaseline ? { alignmentBaseline: firstSpan.alignmentBaseline } : {}),
          ...(firstSpan.baselineShift
            ? { baselineShift: typeof firstSpan.baselineShift === "string" ? 0 : resolveSvgLength(firstSpan.baselineShift, fontSize, fontSize) ?? 0 }
            : {}),
          ...(textPathContours && firstChunk.textPath
            ? { textPath: { contours: textPathContours, startOffset: textPathStartOffset ?? 0, method: firstChunk.textPath.method ?? "align", spacing: firstChunk.textPath.spacing ?? "auto" } }
            : {}),
          ...(stroke && stroke !== "#00000000" && strokeWidth !== undefined
            ? { stroke, ...(strokePaint ? { strokePaint } : {}), strokeWidth, ...(firstSpan.strokeOpacity !== undefined ? { strokeOpacity: firstSpan.strokeOpacity } : {}) }
            : {}),
          ...(firstSpan.paintOrder ? { paintOrder: lowerPaintOrder(firstSpan.paintOrder) ?? ["fill", "stroke", "markers"] } : {}),
          ...(textDecoration ? { textDecoration } : {}),
          align: textAlign,
          verticalAlign: "top",
          wrap: layer.payload.layout?.wrap ?? "none",
          overflow: layer.clipPath ? "clip" : "visible",
          direction: layer.payload.source.direction ?? "ltr",
          writingMode: layer.payload.source.writingMode,
          language: layer.payload.source?.language ?? "und",
          fill: paintColor(firstSpan.fill, paintServers, context.currentColor) ?? "#000000",
          spanFills: layer.payload.chunks.flatMap((chunk) => chunk.spans.flatMap((span) => {
            const fill = paintColor(span.fill, paintServers, context.currentColor);
            return fill ? [{ start: span.sourceRange.start, end: span.sourceRange.end, fill }] : [];
          })),
          width: layer.frame.width,
          height: layer.frame.height,
          ...(layer.payload.layout?.contentWidth === undefined ? {} : { contentWidth: layer.payload.layout.contentWidth }),
          ...(layer.payload.layout?.contentHeight === undefined ? {} : { contentHeight: layer.payload.layout.contentHeight }),
          ...(layer.payload.layout?.contentOffsetX === undefined ? {} : { contentOffsetX: layer.payload.layout.contentOffsetX }),
          ...(layer.payload.layout?.contentOffsetY === undefined ? {} : { contentOffsetY: layer.payload.layout.contentOffsetY }),
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "path") {
      for (const capability of [
        "path.transform",
        "path.timing",
        "path.opacity",
        "path.order",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const sourceContours = layer.payload.morph
        ? interpolatePathContours(
            layer.payload.contours,
            layer.payload.morph.targetContours,
            layer.payload.morph.progress,
          )
        : layer.payload.contours;
      const contours = sourceContours.map((contour) => ({
        ...contour,
        ...(layer.payload.pathLength === undefined ? {} : { pathLength: layer.payload.pathLength }),
      }));
      const authoredFill: ProtocolPaint = layer.style.fill ?? "#000000";
      const fillPaint = runtimePaint(authoredFill, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
      const hasFill = fillPaint?.type !== "none" && hasFillableRegion(contours);
      if (hasFill && !isV2AtomCertified("path.fill")) {
        throw new Error("Uncertified Protocol V2 atom: path.fill");
      }
      if (layer.style.fillOpacity !== undefined && !isV2AtomCertified("path.fillOpacity")) {
        throw new Error("Uncertified Protocol V2 atom: path.fillOpacity");
      }
      if (layer.style.stroke !== undefined && !isV2AtomCertified("path.stroke")) {
        throw new Error("Uncertified Protocol V2 atom: path.stroke");
      }
      if (layer.style.paintOrder !== undefined && !isV2AtomCertified("path.paintOrder")) {
        throw new Error("Uncertified Protocol V2 atom: path.paintOrder");
      }
      if (layer.style.markerStart || layer.style.markerMid || layer.style.markerEnd) {
        if (!isV2AtomCertified("path.markers")) {
          throw new Error("Uncertified Protocol V2 atom: path.markers");
        }
      }
      if (layer.style.strokeWidth !== undefined) {
        if (!isV2AtomCertified("path.strokeWidth")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeWidth");
        }
      }
      if (layer.style.strokeOpacity !== undefined) {
        if (!isV2AtomCertified("path.strokeOpacity")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeOpacity");
        }
      }
      if (layer.style.stroke !== undefined) {
        for (const capability of ["path.strokeJoin", "path.strokeCap"]) {
          if (!isV2AtomCertified(capability)) {
            throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
          }
        }
        if (layer.style.strokeDash && !isV2AtomCertified("path.strokeDash")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeDash");
        }
      }
      if (layer.style.vectorEffect !== undefined && !isV2AtomCertified("path.vectorEffect")) {
        throw new Error("Uncertified Protocol V2 atom: path.vectorEffect");
      }
      if (layer.payload.morph && !isV2AtomCertified("path.morph")) {
        throw new Error("Uncertified Protocol V2 atom: path.morph");
      }
      const strokeWidth = lowerStrokeWidth(layer.style.strokeWidth, layer.frame.width, layer.frame.height, DEFAULT_PATH_STROKE_WIDTH);
      const strokeJoin = layer.style.strokeJoin ?? "miter";
      const strokeCap = layer.style.strokeCap ?? "butt";
      const strokeDash = lowerStrokeDash(layer.style.strokeDash, layer.frame.width, layer.frame.height);
      const paintOrder = lowerPaintOrder(layer.style.paintOrder);
      const markers = lowerMarkers(project.markers, layer.style, contours, strokeWidth, paintServers, context.currentColor);
      const strokePaint = runtimePaint(layer.style.stroke, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
      const fillColorValue = paintColor(authoredFill, paintServers, context.currentColor);
      const strokeColorValue = paintColor(layer.style.stroke, paintServers, context.currentColor);
      const pathPaintCapability = paintCapability("path", layer.style.fill);
      if (pathPaintCapability && !isV2AtomCertified(pathPaintCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${pathPaintCapability}`);
      }
      const pathStrokePaintCapability = paintCapability("path", layer.style.stroke);
      if (pathStrokePaintCapability && !isV2AtomCertified(pathStrokePaintCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${pathStrokePaintCapability}`);
      }
      const effects = lowerLayerEffects(layer, project);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        ...semanticState,
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "path" as const,
          width: layer.frame.width,
          height: layer.frame.height,
          contours,
          ...(hasFill
            ? {
                mesh: tessellateClosedPath(contours, layer.payload.fillRule),
                fill: fillColorValue!,
                ...(fillPaint ? { fillPaint } : {}),
              }
            : {}),
          ...(layer.style.stroke !== undefined
            ? {
                stroke: strokeColorValue!,
                ...(strokePaint ? { strokePaint } : {}),
                strokeWidth,
                strokeMesh: tessellatePathStroke(
                  contours,
                  strokeWidth,
                  {
                    join: strokeJoin,
                    cap: strokeCap,
                    miterLimit: layer.style.strokeMiterLimit,
                    dash: strokeDash,
                  },
                ),
                ...(layer.style.strokeOpacity !== undefined
                  ? { strokeOpacity: layer.style.strokeOpacity }
                  : {}),
                ...(layer.style.strokeMiterLimit !== undefined
                  ? { strokeMiterLimit: layer.style.strokeMiterLimit }
                  : {}),
                strokeJoin,
                strokeCap,
                ...(strokeDash ? { strokeDash } : {}),
              }
            : {}),
          ...(layer.style.vectorEffect ? { vectorEffect: layer.style.vectorEffect } : {}),
          fillRule: layer.payload.fillRule,
          ...(layer.style.fillOpacity !== undefined
            ? { fillOpacity: layer.style.fillOpacity }
            : {}),
          ...(paintOrder ? { paintOrder } : {}),
          ...(markers ? { markers } : {}),
          ...(effects ? { effects } : {}),
        },
      };
    }
    const shapeCapabilityName = layer.payload.shape;
    const fillCapability = `${layer.type}.${shapeCapabilityName}.fill`;
    if (!isV2AtomCertified(fillCapability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${fillCapability}`);
    }
    const authoredFill: ProtocolPaint = layer.style.fill ?? "#000000";
    const fillPaint = runtimePaint(authoredFill, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
    const strokePaint = runtimePaint(layer.style.stroke, layer.frame.width, layer.frame.height, paintServers, context.currentColor);
    const gradientCapability = paintCapability("shape", layer.style.fill);
    if (gradientCapability && !isV2AtomCertified(`${layer.type}.${layer.payload.shape}.${gradientCapability.split(".").at(-1)}`)) {
      throw new Error(`Uncertified Protocol V2 atom: ${layer.type}.${layer.payload.shape}.${gradientCapability.split(".").at(-1)}`);
    }
    const strokePaintCapability = paintCapability("shape", layer.style.stroke);
    if (strokePaintCapability && !isV2AtomCertified(`${layer.type}.${layer.payload.shape}.${strokePaintCapability.split(".").at(-1)}`)) {
      throw new Error(`Uncertified Protocol V2 atom: ${layer.type}.${layer.payload.shape}.${strokePaintCapability.split(".").at(-1)}`);
    }
    if (layer.style.stroke !== undefined) {
      const strokeCapability = `${layer.type}.${layer.payload.shape}.stroke`;
      if (!isV2AtomCertified(strokeCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeCapability}`);
      }
    }
    if (layer.style.strokeWidth !== undefined) {
      const strokeWidthCapability = `${layer.type}.${layer.payload.shape}.strokeWidth`;
      if (!isV2AtomCertified(strokeWidthCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeWidthCapability}`);
      }
    }
    if (layer.style.fillOpacity !== undefined) {
      const fillOpacityCapability = `${layer.type}.${layer.payload.shape}.fillOpacity`;
      if (!isV2AtomCertified(fillOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${fillOpacityCapability}`);
      }
    }
    if (layer.style.strokeOpacity !== undefined) {
      const strokeOpacityCapability = `${layer.type}.${layer.payload.shape}.strokeOpacity`;
      if (!isV2AtomCertified(strokeOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeOpacityCapability}`);
      }
    }
    for (const property of ["strokeJoin", "strokeCap", "strokeDash"] as const) {
      if (layer.style[property] !== undefined) {
        const capability = `${layer.type}.${layer.payload.shape}.${property}`;
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
    }
    if (layer.style.vectorEffect !== undefined) {
      const capability = `${layer.type}.${layer.payload.shape}.vectorEffect`;
      if (!isV2AtomCertified(capability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
      }
    }
    if (layer.style.paintOrder !== undefined) {
      const capability = `${layer.type}.${layer.payload.shape}.paintOrder`;
      if (!isV2AtomCertified(capability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
      }
    }
    if (layer.style.markerStart || layer.style.markerMid || layer.style.markerEnd) {
      const capability = `${layer.type}.${layer.payload.shape}.markers`;
      if (!isV2AtomCertified(capability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
      }
    }
    if (layer.payload.cornerRadius !== undefined) {
      if (layer.payload.shape !== "rectangle") {
        throw new Error(`Protocol V2 atom ${layer.id}: cornerRadius requires rectangle`);
      }
      const cornerRadiusCapability = `${layer.type}.${layer.payload.shape}.cornerRadius`;
      if (!isV2AtomCertified(cornerRadiusCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${cornerRadiusCapability}`);
      }
    }

    const effects = lowerLayerEffects(layer, project);
    const paintOrder = lowerPaintOrder(layer.style.paintOrder);
    const shapeContour = {
      ...primitivePathContour(layer.payload, layer.frame.width, layer.frame.height),
      ...(layer.payload.pathLength === undefined ? {} : { pathLength: layer.payload.pathLength }),
    };
    const strokeWidth = lowerStrokeWidth(layer.style.strokeWidth, layer.frame.width, layer.frame.height, DEFAULT_RECTANGLE_STROKE_WIDTH);
    const strokeDash = lowerStrokeDash(layer.style.strokeDash, layer.frame.width, layer.frame.height);
    const markers = lowerMarkers(project.markers, layer.style, [shapeContour], strokeWidth, paintServers, context.currentColor);
    return {
      id: layer.id,
        parentId: layer.parentLayerId,
      order: layer.order,
      timing: context.timing,
      opacity: context.opacity,
      blendMode,
      ...(isolation ? { isolation } : {}),
      ...semanticState,
      backfaceVisibility: layer.backfaceVisibility,
      visible: context.visible,
      localMatrix: context.localMatrix,
      worldMatrix: context.worldMatrix,
      content: {
        kind: "path" as const,
        width: layer.frame.width,
        height: layer.frame.height,
        contours: [shapeContour],
        fillRule: "nonzero" as const,
        ...(layer.payload.shape !== "line" && fillPaint?.type !== "none"
          ? { fill: paintColor(authoredFill, paintServers, context.currentColor)!, ...(fillPaint ? { fillPaint } : {}) }
          : {}),
        ...(layer.style.fillOpacity !== undefined
          ? { fillOpacity: layer.style.fillOpacity }
          : {}),
        ...(layer.style.stroke !== undefined
          ? {
              stroke: paintColor(layer.style.stroke, paintServers, context.currentColor)!,
              ...(strokePaint ? { strokePaint } : {}),
              strokeWidth,
              ...(layer.style.strokeOpacity !== undefined
                ? { strokeOpacity: layer.style.strokeOpacity }
                : {}),
              ...(layer.style.strokeMiterLimit !== undefined
                ? { strokeMiterLimit: layer.style.strokeMiterLimit }
                : {}),
              ...(layer.style.strokeJoin ? { strokeJoin: layer.style.strokeJoin } : {}),
              ...(layer.style.strokeCap ? { strokeCap: layer.style.strokeCap } : {}),
                ...(strokeDash ? { strokeDash } : {}),
            }
          : {}),
        ...(layer.style.vectorEffect ? { vectorEffect: layer.style.vectorEffect } : {}),
        ...(paintOrder ? { paintOrder } : {}),
        ...(markers ? { markers } : {}),
        ...(layer.payload.shape !== "line" && fillPaint?.type !== "none"
          ? { mesh: tessellateClosedPath([shapeContour], "nonzero") }
          : {}),
        ...(layer.style.stroke
          ? {
              strokeMesh: tessellatePathStroke(
                [shapeContour],
                strokeWidth,
                {
                  join: layer.style.strokeJoin ?? "miter",
                  cap: layer.style.strokeCap ?? "butt",
                  miterLimit: layer.style.strokeMiterLimit,
                  dash: strokeDash,
                },
              ),
            }
          : {}),
        ...(effects ? { effects } : {}),
      } as VisualRuntimeNode["content"],
    };
  }).filter((node): node is VisualRuntimeNode => node !== null);
  const nodes = [...compiledLayerNodes, ...semanticMaskNodes];

  const visualDuration = nodes.reduce(
    (duration, node) => Math.max(duration, node.timing.start + node.timing.duration),
    0,
  );
  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: project.id,
    composition: {
      width: project.composition.width,
      height: project.composition.height,
      fps: project.composition.fps,
      duration: visualDuration,
      background: project.composition.background,
      graphId: project.id,
    },
    view: projection,
    nodes,
  };
}

/**
 * Internal V3 visual boundary. The certified lowering implementation remains
 * shared while media/audio V3 compilation bypasses the legacy runtime shape.
 */
export function compileVisualProject(
  input: unknown,
  options: CompileProtocolOptions = {},
): RuntimeVisualProjectV3 {
  const legacy = compileVisualRuntimeInternal(input, options);
  return {
    composition: legacy.composition,
    view: legacy.view,
    nodes: legacy.nodes,
  };
}
