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
  type VisualRuntimeProject,
  type PathContour,
  type PaintFill,
  type VisualRuntimeMask,
  identityMatrix4,
  interpolatePathContours,
  tessellateClosedPath,
      tessellatePathStroke,
} from "@motionvideo/motion-runtime";
import {
  parseMotionProtocol,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol";
import { isCompilerFeatureSupported } from "./capabilities";
import { canonicalizePaint } from "./paint";

const isV2AtomCertified = isCompilerFeatureSupported;
type ShapePayload = Extract<MotionProtocolV2["layers"][number], { type: "shape" }>["payload"];
type ProtocolPaint = Extract<MotionProtocolV2["layers"][number], { type: "shape" }>['style']['fill'];

function runtimePaint(paint: ProtocolPaint | undefined, width: number, height: number): PaintFill | undefined {
  return canonicalizePaint(paint, width, height);
}

function paintColor(paint: ProtocolPaint | undefined): string | undefined {
  if (typeof paint === "string") return paint;
  if (paint?.type === "none") return "#00000000";
  if (paint?.type === "solid") return paint.color;
  if (paint && "stops" in paint) return paint.stops[0]?.color ?? "#00000000";
  if (paint?.type === "pattern") {
    const fill = paint.content[0] && "fill" in paint.content[0] ? paint.content[0].fill : undefined;
    return typeof fill === "string" ? fill : fill?.type === "solid" ? fill.color : "#00000000";
  }
  return undefined;
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
    const radiusX = Math.min(payload.rx ?? payload.cornerRadius ?? payload.ry ?? 0, width / 2);
    const radiusY = Math.min(payload.ry ?? payload.cornerRadius ?? payload.rx ?? 0, height / 2);
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

function lowerBlendMode(layer: ProtocolLayer): VisualRuntimeNode["blendMode"] {
  const blendMode = layer.composite?.blendMode ?? "normal";
  const capability = `composite.blend.${blendMode}`;
  if (!isV2AtomCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
  }
  return blendMode;
}

function lowerMask(
  layer: MotionProtocolV2["layers"][number],
  layersById: ReadonlyMap<string, MotionProtocolV2["layers"][number]>,
): VisualRuntimeMask | undefined {
  const masks = layer.composite?.masks;
  if (!masks?.length) return undefined;
  if (masks.length > 1) {
    throw new Error(`Protocol V2 multi-mask runtime lowering is not implemented yet: ${layer.id}`);
  }
  const mask = masks[0]!;
  if (mask.composite !== "add") {
    throw new Error(`Protocol V2 mask composite operator is not implemented yet: ${mask.composite}`);
  }
  if (layer.type !== "group") {
    throw new Error(`Protocol V2 mask must target a group: ${layer.id}`);
  }
  const capability = `mask.${mask.mode}`;
  if (!isV2AtomCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
  }
  const source = layersById.get(mask.sourceLayerId);
  if (!source || source.parentLayerId !== layer.id || source.type === "group" || (mask.mode === "clip" && source.type !== "shape")) {
    throw new Error(`Protocol V2 ${mask.mode} mask source is invalid: ${layer.id}`);
  }
  return { mode: mask.mode, sourceId: source.id, composite: mask.composite };
}

type LayerContext = {
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  opacity: number;
  visible: boolean;
  timing: { start: number; duration: number };
};

/** Options accepted by the canonical Protocol compiler. */
export type CompileProtocolOptions = Record<string, never>;
/** Internal certified visual lowering used by the Runtime V3 compiler. */
function compileVisualRuntimeInternal(
  input: unknown,
  _options: CompileProtocolOptions = {},
): VisualRuntimeProject {
  const project = parseMotionProtocol(input);
  const projection = viewProjectionMatrix4(project);
  const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
  const contextCache = new Map<string, LayerContext>();

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
      visible: parentContext.visible && layer.enabled !== false && layer.opacity > 0 && end > start,
      timing: { start, duration: Math.max(0, end - start) },
    };
    contextCache.set(layer.id, context);
    return context;
  };

  const nodes = project.layers.map((layer): VisualRuntimeNode | null => {
    const context = resolveLayerContext(layer);
    for (const capability of [
      ...(layer.enabled !== undefined ? ["layer.enabled"] : []),
      ...(layer.backfaceVisibility !== undefined ? ["layer.backfaceVisibility"] : []),
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
    const groupEffects = layer.type === "group" ? lowerEffects(layer.effects) : undefined;
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
      const mask = lowerMask(layer, layerById);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        backfaceVisibility: layer.backfaceVisibility,
        ...(mask ? { mask } : {}),
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
      const effects = lowerEffects(layer.effects);
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
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
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
      const firstRun = layer.payload.layout.runs[0]!;
      const sourceText = layer.payload.source?.text ?? "";
      const textFontAssetId = firstRun.font.assetId;
      const textLineHeight = layer.frame.height / Math.max(1, layer.payload.layout.lines.length);
      for (const capability of [
        "text.transform",
        "text.timing",
        "text.opacity",
        "text.order",
        "text.font",
        layer.payload.layout.lines.length > 1 ? "text.layout.multiline" : "text.layout.singleLine",
        "text.layout.glyphs",
        "text.fill",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === textFontAssetId);
      if (asset?.kind !== "font") {
        throw new Error(`Protocol V2 text layer ${layer.id} references a non-font asset`);
      }
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
        backfaceVisibility: layer.backfaceVisibility,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "text" as const,
          text: sourceText,
          fontAssetId: textFontAssetId,
          fontUri: asset.uri,
          fontIntegrity: asset.integrity,
          fontSize: firstRun.font.size,
          lineHeight: textLineHeight,
          letterSpacing: 0,
          align: "left",
          verticalAlign: "top",
          wrap: "none",
          overflow: "visible",
          direction: "ltr",
          language: layer.payload.source?.language ?? "und",
          fill: firstRun.fill,
          width: layer.frame.width,
          height: layer.frame.height,
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
      const contours = layer.payload.morph
        ? interpolatePathContours(
            layer.payload.contours,
            layer.payload.morph.targetContours,
            layer.payload.morph.progress,
          )
        : layer.payload.contours;
      const hasFill = layer.style.fill !== undefined;
      if (hasFill && !isV2AtomCertified("path.fill")) {
        throw new Error("Uncertified Protocol V2 atom: path.fill");
      }
      if (layer.style.fillOpacity !== undefined && !isV2AtomCertified("path.fillOpacity")) {
        throw new Error("Uncertified Protocol V2 atom: path.fillOpacity");
      }
      if (layer.style.stroke !== undefined && !isV2AtomCertified("path.stroke")) {
        throw new Error("Uncertified Protocol V2 atom: path.stroke");
      }
      if (layer.style.strokeWidth !== undefined) {
        if (layer.style.stroke === undefined) {
          throw new Error(`Protocol V2 atom ${layer.id}: strokeWidth requires stroke`);
        }
        if (!isV2AtomCertified("path.strokeWidth")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeWidth");
        }
      }
      if (layer.style.strokeOpacity !== undefined) {
        if (layer.style.stroke === undefined) {
          throw new Error(`Protocol V2 atom ${layer.id}: strokeOpacity requires stroke`);
        }
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
      if (layer.payload.morph && !isV2AtomCertified("path.morph")) {
        throw new Error("Uncertified Protocol V2 atom: path.morph");
      }
      const strokeWidth = layer.style.strokeWidth ?? DEFAULT_PATH_STROKE_WIDTH;
      const strokeJoin = layer.style.strokeJoin ?? "miter";
      const strokeCap = layer.style.strokeCap ?? "butt";
      const strokeDash = layer.style.strokeDash
        ? { array: layer.style.strokeDash.array, offset: layer.style.strokeDash.offset ?? 0 }
        : undefined;
      const fillPaint = runtimePaint(layer.style.fill, layer.frame.width, layer.frame.height);
      const strokePaint = runtimePaint(layer.style.stroke, layer.frame.width, layer.frame.height);
      const fillColorValue = paintColor(layer.style.fill);
      const strokeColorValue = paintColor(layer.style.stroke);
      const pathPaintCapability = paintCapability("path", layer.style.fill);
      if (pathPaintCapability && !isV2AtomCertified(pathPaintCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${pathPaintCapability}`);
      }
      const pathStrokePaintCapability = paintCapability("path", layer.style.stroke);
      if (pathStrokePaintCapability && !isV2AtomCertified(pathStrokePaintCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${pathStrokePaintCapability}`);
      }
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(isolation ? { isolation } : {}),
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
          fillRule: layer.payload.fillRule,
          ...(layer.style.fillOpacity !== undefined
            ? { fillOpacity: layer.style.fillOpacity }
            : {}),
          ...(effects ? { effects } : {}),
        },
      };
    }
    const shapeCapabilityName = layer.payload.shape;
    const fillCapability = `${layer.type}.${shapeCapabilityName}.fill`;
    if (!isV2AtomCertified(fillCapability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${fillCapability}`);
    }
    const fillPaint = runtimePaint(layer.style.fill, layer.frame.width, layer.frame.height);
    const strokePaint = runtimePaint(layer.style.stroke, layer.frame.width, layer.frame.height);
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
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeWidth requires stroke`);
      }
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
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeOpacity requires stroke`);
      }
      const strokeOpacityCapability = `${layer.type}.${layer.payload.shape}.strokeOpacity`;
      if (!isV2AtomCertified(strokeOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeOpacityCapability}`);
      }
    }
    for (const property of ["strokeJoin", "strokeCap", "strokeDash"] as const) {
      if (layer.style[property] !== undefined) {
        if (layer.style.stroke === undefined) {
          throw new Error(`Protocol V2 atom ${layer.id}: ${property} requires stroke`);
        }
        const capability = `${layer.type}.${layer.payload.shape}.${property}`;
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
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

    const effects = lowerEffects(layer.effects);
    const shapeContour = primitivePathContour(layer.payload, layer.frame.width, layer.frame.height);
    return {
      id: layer.id,
        parentId: layer.parentLayerId,
      order: layer.order,
      timing: context.timing,
      opacity: context.opacity,
      blendMode,
      ...(isolation ? { isolation } : {}),
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
        ...(layer.style.fill
          ? { fill: paintColor(layer.style.fill)!, ...(fillPaint ? { fillPaint } : {}) }
          : {}),
        ...(layer.style.fillOpacity !== undefined
          ? { fillOpacity: layer.style.fillOpacity }
          : {}),
        ...(layer.style.stroke !== undefined
          ? {
              stroke: paintColor(layer.style.stroke)!,
              ...(strokePaint ? { strokePaint } : {}),
              strokeWidth: layer.style.strokeWidth ?? DEFAULT_RECTANGLE_STROKE_WIDTH,
              ...(layer.style.strokeOpacity !== undefined
                ? { strokeOpacity: layer.style.strokeOpacity }
                : {}),
              ...(layer.style.strokeMiterLimit !== undefined
                ? { strokeMiterLimit: layer.style.strokeMiterLimit }
                : {}),
              ...(layer.style.strokeJoin ? { strokeJoin: layer.style.strokeJoin } : {}),
              ...(layer.style.strokeCap ? { strokeCap: layer.style.strokeCap } : {}),
              ...(layer.style.strokeDash
                ? { strokeDash: { array: layer.style.strokeDash.array, offset: layer.style.strokeDash.offset ?? 0 } }
                : {}),
            }
          : {}),
        ...(layer.style.fill && layer.payload.shape !== "line"
          ? { mesh: tessellateClosedPath([shapeContour], "nonzero") }
          : {}),
        ...(layer.style.stroke
          ? {
              strokeMesh: tessellatePathStroke(
                [shapeContour],
                layer.style.strokeWidth ?? DEFAULT_RECTANGLE_STROKE_WIDTH,
                {
                  join: layer.style.strokeJoin ?? "miter",
                  cap: layer.style.strokeCap ?? "butt",
                  miterLimit: layer.style.strokeMiterLimit,
                  dash: layer.style.strokeDash
                    ? { array: layer.style.strokeDash.array, offset: layer.style.strokeDash.offset ?? 0 }
                    : undefined,
                },
              ),
            }
          : {}),
        ...(effects ? { effects } : {}),
      } as VisualRuntimeNode["content"],
    };
  }).filter((node): node is VisualRuntimeNode => node !== null);

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
