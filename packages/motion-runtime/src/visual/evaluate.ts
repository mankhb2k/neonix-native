import { frameToTime } from "../foundation/determinism";
import {
  identityMatrix4,
  matrix4ToArray,
  multiplyMatrix4,
  projectPoint3D,
  translationMatrix3D,
  type Matrix4,
  type Point3D,
} from "../geometry/matrix4";
import { tessellateNonScalingStroke } from "../geometry/path";
import type { PaintCommand } from "../paint/paint-command";
import type { PathContour } from "../paint/paint-types";
import { normalizeVisualRuntimeProject, validateVisualRuntimeProject } from "./validate";
import { buildRuntimeEffectProgram } from "./effects";
import type { VisualRuntimeFrame, VisualRuntimeNode, VisualRuntimeProject, VisualRuntimeVideo } from "./types";

function assertFrame(frame: number): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new Error("Runtime V2 frame must be a non-negative safe integer");
  }
}

function stableNodeOrder(nodes: readonly VisualRuntimeNode[]): VisualRuntimeNode[] {
  return [...nodes].sort(
    (left, right) =>
      left.order - right.order ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}

function nodeIsActive(node: VisualRuntimeNode, time: number): boolean {
  return (
    node.visible &&
    node.opacity > 0 &&
    time >= node.timing.start &&
    time < node.timing.start + node.timing.duration
  );
}

function quantizeVideoFrame(
  frame: number,
  policy: VisualRuntimeVideo["framePolicy"],
): number {
  if (policy === "round") return Math.round(frame);
  if (policy === "ceil") return Math.ceil(frame);
  return Math.floor(frame);
}

/**
 * Border fragments lowered by the HTML compiler are many adjacent filled
 * paths. Keeping their individual transforms/draws makes Skia antialias each
 * shared edge independently, which can expose seams that CSS paints as one
 * border. Only translation-only fragments are eligible: all other geometry
 * keeps the normal per-node path semantics.
 */
function isTranslationOnlyMatrix(matrix: Matrix4): boolean {
  return (
    matrix.length === 16 &&
    Array.from(matrix).every(Number.isFinite) &&
    Math.abs(matrix[0]! - 1) < 1e-9 &&
    Math.abs(matrix[1]!) < 1e-9 &&
    Math.abs(matrix[2]!) < 1e-9 &&
    Math.abs(matrix[3]!) < 1e-9 &&
    Math.abs(matrix[4]!) < 1e-9 &&
    Math.abs(matrix[5]! - 1) < 1e-9 &&
    Math.abs(matrix[6]!) < 1e-9 &&
    Math.abs(matrix[7]!) < 1e-9 &&
    Math.abs(matrix[8]!) < 1e-9 &&
    Math.abs(matrix[9]!) < 1e-9 &&
    Math.abs(matrix[10]! - 1) < 1e-9 &&
    Math.abs(matrix[11]!) < 1e-9 &&
    Math.abs(matrix[14]!) < 1e-9 &&
    Math.abs(matrix[15]! - 1) < 1e-9
  );
}

function translatePathContour(contour: PathContour, matrix: Matrix4, id: string): PathContour {
  const translate = (point: { x: number; y: number }) => ({
    x: point.x + matrix[12]!,
    y: point.y + matrix[13]!,
  });
  return {
    id,
    start: translate(contour.start),
    segments: contour.segments.map((segment) => {
      if (segment.kind === "line") return { kind: "line", to: translate(segment.to) };
      if (segment.kind === "quadratic") {
        return {
          kind: "quadratic",
          control: translate(segment.control),
          to: translate(segment.to),
        };
      }
      if (segment.kind === "cubic") {
        return {
          kind: "cubic",
          control1: translate(segment.control1),
          control2: translate(segment.control2),
          to: translate(segment.to),
        };
      }
      return {
        kind: "arc",
        radii: { ...segment.radii },
        rotation: segment.rotation,
        largeArc: segment.largeArc,
        sweep: segment.sweep,
        to: translate(segment.to),
      };
    }),
    closed: contour.closed,
    ...(contour.pathLength !== undefined ? { pathLength: contour.pathLength } : {}),
  };
}

function borderFragmentSide(node: VisualRuntimeNode): "top" | "right" | "bottom" | "left" | undefined {
  if (node.content.kind !== "path") return undefined;
  const match = /::border:(top|right|bottom|left):\d+$/.exec(node.id);
  return match?.[1] as "top" | "right" | "bottom" | "left" | undefined;
}

function resolveVideoMedia(
  video: VisualRuntimeVideo,
  localTime: number,
): { mediaTime: number; visible: boolean } {
  const trimStart = video.trimStart;
  const trimEnd = video.trimEnd ?? video.sourceDuration;
  const span = trimEnd === undefined ? Number.POSITIVE_INFINITY : trimEnd - trimStart;
  if (!Number.isFinite(video.sourceFps) || video.sourceFps <= 0 || span <= 0 || localTime < 0) {
    return { mediaTime: trimStart, visible: false };
  }

  const elapsed = localTime;
  if (elapsed >= span) {
    return {
      mediaTime: Math.max(trimStart, (trimEnd ?? trimStart) - 1 / video.sourceFps),
      visible: false,
    };
  }

  let mediaTime = trimStart + quantizeVideoFrame(elapsed * video.sourceFps, video.framePolicy) / video.sourceFps;
  if (trimEnd !== undefined && mediaTime >= trimEnd) {
    mediaTime = Math.max(trimStart, trimEnd - 1 / video.sourceFps);
  }
  return { mediaTime, visible: true };
}

/**
 * Evaluate the V2 runtime scene into the backend-neutral paint contract.
 *
 * This first slice intentionally handles only certified shape atoms. Matrix
 * calculation belongs to Compiler B; this evaluator only resolves active
 * windows, stable order, and the already-resolved runtime matrices.
 */
export type VisualRuntimeNodeOverride = Partial<Omit<VisualRuntimeNode, "id">>;

export type PreparedVisualRuntimeProject = {
  project: VisualRuntimeProject;
  childrenByParent: ReadonlyMap<string | null, readonly VisualRuntimeNode[]>;
};

/** Normalize, validate and index a visual project once before frame evaluation. */
export function prepareVisualRuntimeProject(project: VisualRuntimeProject): PreparedVisualRuntimeProject {
  // Native VPS inputProps cross a JSON boundary. Rehydrate Matrix4 values before
  // validation and arithmetic; otherwise serialized typed arrays are plain
  // objects without a numeric length and matrix operations produce NaN.
  const normalized = normalizeVisualRuntimeProject(project);
  const validation = validateVisualRuntimeProject(normalized);
  if (!validation.ok) {
    throw new Error(
      `Runtime V2 validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" | ")}`,
    );
  }
  const childrenByParent = new Map<string | null, VisualRuntimeNode[]>();
  for (const node of normalized.nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(parentId, stableNodeOrder(children));
  }
  return { project: normalized, childrenByParent };
}

export function evaluateVisualRuntimeProject(
  project: VisualRuntimeProject,
  frame: number,
  options: { time?: number; outputScale?: number } = {},
): VisualRuntimeFrame {
  return evaluatePreparedVisualRuntimeProject(prepareVisualRuntimeProject(project), frame, options);
}

/** Evaluate an indexed visual project without repeating normalization or validation. */
export function evaluatePreparedVisualRuntimeProject(
  prepared: PreparedVisualRuntimeProject,
  frame: number,
  options: { time?: number; outputScale?: number } = {},
  overrides?: ReadonlyMap<string, VisualRuntimeNodeOverride>,
): VisualRuntimeFrame {
  const project = prepared.project;
  assertFrame(frame);
  if (!Number.isFinite(project.composition.fps) || project.composition.fps <= 0) {
    throw new Error("Runtime V2 composition fps must be finite and positive");
  }
  const time = options.time ?? frameToTime(frame, project.composition.fps);
  if (!Number.isFinite(time) || time < 0) {
    throw new Error("Runtime V2 time must be finite and non-negative");
  }
  const outputScale = options.outputScale ?? 1;
  if (!Number.isFinite(outputScale) || outputScale <= 0) {
    throw new Error("Runtime V2 outputScale must be finite and positive");
  }
  const commands: PaintCommand[] = [
    {
      op: "beginFrame",
      width: project.composition.width,
      height: project.composition.height,
      background: project.composition.background,
      graphId: project.composition.graphId,
      frame,
      time,
      projection: {
        worldToClipMatrix: matrix4ToArray(project.view.worldToClipMatrix),
        ...(project.view.depthClip ? { depthClip: project.view.depthClip } : {}),
      },
    },
  ];
  const diagnostics = [] as NonNullable<VisualRuntimeFrame["diagnostics"]>;

  const overrideMap = overrides ?? new Map<string, VisualRuntimeNodeOverride>();
  const resolvedNodes = new Map<string, VisualRuntimeNode>();
  const resolveNode = (node: VisualRuntimeNode): VisualRuntimeNode => {
    const cached = resolvedNodes.get(node.id);
    if (cached) return cached;
    const override = overrideMap.get(node.id);
    const resolved = override ? { ...node, ...override, id: node.id } : node;
    resolvedNodes.set(node.id, resolved);
    return resolved;
  };
  const hasStructuralOverrides = Array.from(overrideMap.values()).some(
    (override) => override.parentId !== undefined || override.order !== undefined,
  );
  const childrenByParent = hasStructuralOverrides
    ? (() => {
        const indexed = new Map<string | null, VisualRuntimeNode[]>();
        for (const node of project.nodes) {
          const resolved = resolveNode(node);
          const siblings = indexed.get(resolved.parentId) ?? [];
          siblings.push(resolved);
          indexed.set(resolved.parentId, siblings);
        }
        for (const [parentId, children] of indexed) indexed.set(parentId, stableNodeOrder(children));
        return indexed;
      })()
    : prepared.childrenByParent;
  const childrenOf = (parentId: string | null) => {
    const children = childrenByParent.get(parentId) ?? [];
    if (hasStructuralOverrides) return children;
    if (overrideMap.size === 0) return children;
    return children.map(resolveNode);
  };
  const subtreeHasActiveDrawable = (node: VisualRuntimeNode): boolean => {
    if (!nodeIsActive(node, time)) return false;
    if (node.content.kind === "group") return childrenOf(node.id).some(subtreeHasActiveDrawable);
    return node.content.kind !== "text" || node.content.layout !== undefined;
  };

  const emitDrawable = (node: VisualRuntimeNode) => {
    if (node.content.kind === "group") return;
    const content = node.content;

    // An unprepared text node cannot produce a drawText command because its
    // glyph layout is not available yet. Do not emit its transform/effect
    // scope either: an orphan setTransform makes the frame invalid and can
    // crash renderer consumers during an editor mount/reload race.
    if (content.kind === "text" && !content.layout) {
      diagnostics.push({
        severity: "warning",
        code: "runtime_v2_text_unprepared",
        message: `Runtime V2 text layer ${node.id} has no resolved glyph layout`,
        layerId: node.id,
        key: node.id,
      });
      return;
    }

    const nodeViewProjection = multiplyMatrix4(
      project.view.worldToClipMatrix,
      node.worldMatrix,
    );
    const localBounds = content.kind === "path"
      ? (() => {
          const bounds = [content.mesh?.bounds, content.strokeMesh?.bounds].filter(
            (value): value is NonNullable<typeof value> => value !== undefined,
          );
          const left = Math.min(...bounds.map((value) => value.x));
          const top = Math.min(...bounds.map((value) => value.y));
          const right = Math.max(...bounds.map((value) => value.x + value.width));
          const bottom = Math.max(...bounds.map((value) => value.y + value.height));
          return { x: left, y: top, width: right - left, height: bottom - top };
        })()
      : { x: 0, y: 0, width: node.content.width, height: node.content.height };
    const corners: Point3D[] = [
      { x: localBounds.x, y: localBounds.y, z: 0 },
      { x: localBounds.x + localBounds.width, y: localBounds.y, z: 0 },
      { x: localBounds.x + localBounds.width, y: localBounds.y + localBounds.height, z: 0 },
      { x: localBounds.x, y: localBounds.y + localBounds.height, z: 0 },
    ];
    const projectedCorners = corners.map((corner) =>
      projectPoint3D(nodeViewProjection, corner, { depthClip: project.view.depthClip }),
    );
    const fullyClipped = projectedCorners.every((corner) => corner.kind === "clipped");
    if (fullyClipped) {
      const reasons = new Set(projectedCorners.map((corner) => corner.kind === "clipped" ? corner.reason : undefined));
      const reason = reasons.has("behind-camera")
        ? "behind-camera"
        : reasons.has("near-plane")
          ? "near-plane"
          : reasons.has("far-plane")
            ? "far-plane"
            : "non-finite";
      diagnostics.push({
        severity: "warning",
        code: "layer_fully_clipped",
        message: `Runtime V2 layer ${node.id} was fully clipped (${reason})`,
        layerId: node.id,
        key: node.id,
      });
      return;
    }
    if (
      projectedCorners.length > 0 &&
      projectedCorners.every(
        (corner) => corner.kind === "clipped" && corner.reason === "behind-camera",
      )
    ) {
      diagnostics.push({
        severity: "warning",
        code: "layer_behind_camera",
        message: `Runtime V2 layer ${node.id} is entirely behind the camera and was clipped`,
        layerId: node.id,
        key: node.id,
      });
    }

    const effectProgram = content.kind === "text" && !content.layout
      ? undefined
      : buildRuntimeEffectProgram(content.effects);
    // A semantic clip/mask wrapper owns the backdrop capture. Avoid creating
    // a nested backdrop layer inside that transparent wrapper.
    const hasSemanticWrapper = node.clipPath !== undefined || node.mask !== undefined;
    const backdropEffectProgram = hasSemanticWrapper ? undefined : buildRuntimeEffectProgram(node.backdropEffects);
    const blendMode = node.blendMode ?? "normal";
    const blendIsolation = blendMode !== "normal";
    if (blendIsolation || effectProgram || backdropEffectProgram) {
      commands.push({
        op: "beginLayer",
        key: node.id,
        layerId: node.id,
        isolation: blendIsolation || effectProgram?.requiresOffscreen === true || backdropEffectProgram !== undefined,
        offscreen: blendIsolation || effectProgram?.requiresOffscreen === true || backdropEffectProgram !== undefined,
        ...(blendIsolation ? { compositeAlpha: node.opacity } : {}),
        blendMode,
        ...(effectProgram ? { effectProgram } : {}),
        ...(effectProgram ? (() => {
          const effectBox = effectBoxFor(node);
          return effectBox ? { effectBox } : {};
        })() : {}),
        ...(backdropEffectProgram ? { backdropEffectProgram } : {}),
      });
    }
    const nonScalingStrokeMesh = content.kind === "path" &&
      content.vectorEffect === "non-scaling-stroke" &&
      content.stroke !== undefined &&
      content.strokeWidth !== undefined
      ? tessellateNonScalingStroke(
          content.contours,
          content.strokeWidth / outputScale,
          node.worldMatrix,
          {
            join: content.strokeJoin,
            cap: content.strokeCap,
            miterLimit: content.strokeMiterLimit,
            dash: content.strokeDash,
          },
        )
      : undefined;
    if (
      content.kind === "path" &&
      content.vectorEffect === "non-scaling-stroke" &&
      content.stroke !== undefined &&
      content.strokeWidth !== undefined &&
      nonScalingStrokeMesh === undefined
    ) {
      diagnostics.push({
        severity: "warning",
        code: "runtime_v2_non_scaling_stroke_requires_2d_affine",
        message: `Runtime V2 non-scaling-stroke fell back to transformed stroke for non-2D-affine layer ${node.id}`,
        layerId: node.id,
        key: node.id,
      });
    }
    if (content.kind === "path" && (content.markers?.length || content.vectorEffect === "non-scaling-stroke")) {
      if (content.markers?.length && effectProgram) {
        throw new Error(`Runtime V2 marker paths with effects are not certified yet: ${node.id}`);
      }
      const paintOrder = content.paintOrder ?? ["fill", "stroke", "markers"];
      const pushPathPass = (
        key: string,
        pass: "fill" | "stroke",
        marker?: NonNullable<typeof content.markers>[number],
      ) => {
        const source = marker ?? content;
        const useNonScalingStroke = !marker && pass === "stroke" && nonScalingStrokeMesh !== undefined;
        commands.push({
          op: "setTransform",
          key,
          layerId: node.id,
          matrix4: matrix4ToArray(useNonScalingStroke ? identityMatrix4() : node.worldMatrix),
          alpha: blendIsolation ? 1 : node.opacity,
          visible: true,
          order: node.order,
          blendMode,
        });
        commands.push({
          op: "drawPath",
          key,
          layerId: node.id,
          contours: source.contours,
          width: content.width,
          height: content.height,
          fillRule: marker ? "nonzero" : content.fillRule,
          paintOrder: [pass],
          ...(pass === "fill" && source.fill !== undefined
            ? { fill: source.fill, ...(source.fillPaint ? { fillPaint: source.fillPaint } : {}), ...(source.fillOpacity !== undefined ? { fillOpacity: source.fillOpacity } : {}), ...(source.mesh ? { mesh: source.mesh } : {}) }
            : {}),
          ...(pass === "stroke" && source.stroke !== undefined
            ? {
                stroke: source.stroke,
                ...(source.strokePaint ? { strokePaint: source.strokePaint } : {}),
                ...(source.strokeWidth !== undefined ? { strokeWidth: source.strokeWidth } : {}),
                ...(!marker && content.strokeOpacity !== undefined ? { strokeOpacity: content.strokeOpacity } : {}),
                ...(!marker && content.strokeMiterLimit !== undefined ? { strokeMiterLimit: content.strokeMiterLimit } : {}),
                ...(!marker && content.strokeJoin ? { strokeJoin: content.strokeJoin } : {}),
                ...(!marker && content.strokeCap ? { strokeCap: content.strokeCap } : {}),
                ...(!marker && content.strokeDash ? { strokeDash: content.strokeDash } : {}),
                ...(useNonScalingStroke
                  ? { strokeMesh: nonScalingStrokeMesh }
                  : source.strokeMesh
                    ? { strokeMesh: source.strokeMesh }
                    : {}),
              }
            : {}),
          ...(!marker && content.vectorEffect ? { vectorEffect: content.vectorEffect } : {}),
        });
      };
      paintOrder.forEach((pass) => {
        if (pass === "fill" && content.fill !== undefined) pushPathPass(`${node.id}:fill`, "fill");
        if (pass === "stroke" && content.stroke !== undefined) pushPathPass(`${node.id}:stroke`, "stroke");
        if (pass === "markers" && content.markers?.length) {
          content.markers!.forEach((marker, index) => {
            const markerOrder = marker.paintOrder.filter((item) => item !== "markers");
            markerOrder.forEach((markerPass) => {
              if (markerPass === "fill" && marker.fill !== undefined) pushPathPass(`${node.id}:marker:${marker.placement}:${index}:fill`, "fill", marker);
              if (markerPass === "stroke" && marker.stroke !== undefined) pushPathPass(`${node.id}:marker:${marker.placement}:${index}:stroke`, "stroke", marker);
            });
          });
        }
      });
      if (effectProgram || backdropEffectProgram || blendIsolation) commands.push({ op: "endLayer", key: node.id });
      return;
    }
    commands.push({
      op: "setTransform",
      key: node.id,
      layerId: node.id,
      matrix4: matrix4ToArray(node.worldMatrix),
      alpha: blendIsolation ? 1 : node.opacity,
      visible: true,
      order: node.order,
      blendMode,
    });
    if (content.kind === "path") {
      commands.push({
        op: "drawPath",
        key: node.id,
        layerId: node.id,
        contours: content.contours,
        width: content.width,
        height: content.height,
        mesh: content.mesh,
        ...(content.strokeMesh ? { strokeMesh: content.strokeMesh } : {}),
        fillRule: content.fillRule,
        ...(content.fill ? { fill: content.fill } : {}),
        ...(content.fillPaint ? { fillPaint: content.fillPaint } : {}),
        ...(content.fillOpacity != null
          ? { fillOpacity: content.fillOpacity }
          : {}),
        ...(content.stroke ? { stroke: content.stroke } : {}),
        ...(content.strokePaint ? { strokePaint: content.strokePaint } : {}),
        ...(content.strokeWidth != null
          ? { strokeWidth: content.strokeWidth }
          : {}),
        ...(content.strokeOpacity != null
          ? { strokeOpacity: content.strokeOpacity }
          : {}),
        ...(content.strokeMiterLimit != null
          ? { strokeMiterLimit: content.strokeMiterLimit }
          : {}),
        ...(content.strokeJoin ? { strokeJoin: content.strokeJoin } : {}),
        ...(content.strokeCap ? { strokeCap: content.strokeCap } : {}),
        ...(content.strokeDash ? { strokeDash: content.strokeDash } : {}),
        ...(content.paintOrder ? { paintOrder: content.paintOrder } : {}),
        ...(content.vectorEffect ? { vectorEffect: content.vectorEffect } : {}),
      });
    } else if (content.kind === "text") {
      commands.push({
        op: "drawText",
        key: node.id,
        layerId: node.id,
        text: content.text,
        fontSize: content.fontSize,
        fontAssetId: content.fontAssetId,
        align: content.align,
        verticalAlign: content.verticalAlign,
        wrap: content.wrap,
        overflow: content.overflow,
        direction: content.direction,
        language: content.language,
        lineHeight: content.lineHeight,
        letterSpacing: content.letterSpacing,
        fill: content.fill,
        ...(content.fillPaint ? { fillPaint: content.fillPaint } : {}),
        width: content.width,
        height: content.height,
        glyphs: content.layout!.glyphs,
        lines: content.layout!.lines,
        ...(content.paintOrder ? { paintOrder: content.paintOrder } : {}),
        ...(content.layout!.decorations ? { decorations: content.layout!.decorations } : {}),
      });
    } else if (content.kind === "image") {
      commands.push({
        op: "drawImage",
        key: node.id,
        layerId: node.id,
        assetId: content.assetId,
        ...(content.uri ? { uri: content.uri } : {}),
        x: content.x,
        y: content.y,
        width: content.width,
        height: content.height,
        ...(content.fit ? { fit: content.fit } : {}),
        ...(content.preserveAspectRatio ? { preserveAspectRatio: content.preserveAspectRatio } : {}),
        ...(content.imageRendering ? { imageRendering: content.imageRendering } : {}),
      });
    } else if (content.kind === "video") {
      const media = resolveVideoMedia(content, Math.max(0, time - node.timing.start));
      commands.push({
        op: "drawVideo",
        key: node.id,
        layerId: node.id,
        assetId: content.assetId,
        ...(content.uri ? { uri: content.uri } : {}),
        width: content.width,
        height: content.height,
        ...(content.fit ? { fit: content.fit } : {}),
        mediaTime: media.mediaTime,
        mediaVisible: media.visible,
        muted: content.muted,
      });
    } else {
      commands.push({
        op: "drawShape",
        key: node.id,
        layerId: node.id,
        shape: content.shape,
        fill: content.fill,
        width: content.width,
        height: content.height,
        ...(content.fillPaint ? { fillPaint: content.fillPaint } : {}),
        ...(content.fillOpacity != null
          ? { fillOpacity: content.fillOpacity }
          : {}),
        ...(content.cornerRadius != null
          ? { cornerRadius: content.cornerRadius }
          : {}),
        ...(content.stroke ? { stroke: content.stroke } : {}),
        ...(content.strokePaint ? { strokePaint: content.strokePaint } : {}),
        ...(content.strokeWidth != null
          ? { strokeWidth: content.strokeWidth }
          : {}),
        ...(content.strokeOpacity != null
          ? { strokeOpacity: content.strokeOpacity }
          : {}),
        ...(content.strokeMiterLimit != null
          ? { strokeMiterLimit: content.strokeMiterLimit }
          : {}),
      });
    }
    if (effectProgram || backdropEffectProgram || blendIsolation) {
      commands.push({ op: "endLayer", key: node.id });
    }
  };

  const effectBoxFor = (node: VisualRuntimeNode, directChildren: readonly VisualRuntimeNode[] = []) => {
    // Runtime V3 needs the owner's geometric box whenever the Skia backend
    // must replay an ordered box-shadow list from isolated masks. This is not
    // limited to inset shadows: a list containing multiple outer shadows may
    // also need the explicit overlay compositor when CanvasKit cannot blend
    // several DropShadow filters in one ImageFilter graph.
    const hasBoxShadow = node.content.effects?.some(
      (effect) => effect.type === "shadow" && effect.source === "box",
    );
    if (!hasBoxShadow || node.content.kind === "video") return undefined;
    const cornerRadiusFor = (content: VisualRuntimeNode["content"]): number | undefined => {
      if (content.kind === "shape" && content.shape === "rectangle") return content.cornerRadius;
      // HTML border-radius is lowered to a path before Runtime V3. Recover
      // the rounded-box geometry for inset shadows so the Skia-only effect
      // path uses the same clip as the browser even when the fill is alpha 0.
      if (content.kind !== "path" || content.contours.length !== 1) return undefined;
      const segments = content.contours[0]?.segments ?? [];
      const arcs = segments.filter((segment) => segment.kind === "arc");
      if (arcs.length !== 4) return undefined;
      const radius = arcs[0]?.kind === "arc" ? arcs[0].radii : undefined;
      if (!radius || Math.abs(radius.x - radius.y) > 1e-6 || radius.x <= 0) return undefined;
      if (!arcs.every((segment) => segment.kind === "arc" && Math.abs(segment.radii.x - radius.x) <= 1e-6 && Math.abs(segment.radii.y - radius.y) <= 1e-6)) return undefined;
      return radius.x;
    };
    let cornerRadius: number | undefined = cornerRadiusFor(node.content);
    if (node.content.kind === "group") {
      const backgroundShape = directChildren.find(
        (child) => (child.content.kind === "shape" || child.content.kind === "path") &&
          Math.abs(child.content.width - node.content.width) <= 1e-6 &&
          Math.abs(child.content.height - node.content.height) <= 1e-6,
      );
      if (backgroundShape) cornerRadius = cornerRadiusFor(backgroundShape.content);
    }

    // CSS inset box-shadow is based on the padding box when a border exists:
    // the blur starts at the border's inner edge, not at the outer border box.
    // HTML compiler borders are lowered to an inner child with a stroke, so
    // recover that uniform stroke here without changing Protocol V2 semantics.
    const strokeWidthFor = (content: VisualRuntimeNode["content"]): number | undefined => {
      if (content.kind !== "shape" && content.kind !== "path") return undefined;
      return content.strokeWidth;
    };
    const borderChild = directChildren.find((child) => {
      const strokeWidth = strokeWidthFor(child.content);
      if (!strokeWidth || strokeWidth <= 0) return false;
      return (
        Math.abs(node.content.width - child.content.width - strokeWidth) <= 1e-6 &&
        Math.abs(node.content.height - child.content.height - strokeWidth) <= 1e-6
      );
    });
    const borderInset = borderChild ? strokeWidthFor(borderChild.content) ?? 0 : strokeWidthFor(node.content) ?? 0;
    const effectWidth = Math.max(1, node.content.width - borderInset * 2);
    const effectHeight = Math.max(1, node.content.height - borderInset * 2);
    const effectRadius = cornerRadius === undefined ? undefined : Math.max(0, cornerRadius - borderInset);
    const effectMatrix = borderInset > 0
      ? multiplyMatrix4(node.worldMatrix, translationMatrix3D(borderInset, borderInset, 0))
      : node.worldMatrix;
    return {
      width: effectWidth,
      height: effectHeight,
      ...(effectRadius !== undefined ? { cornerRadius: effectRadius } : {}),
      matrix4: matrix4ToArray(effectMatrix),
    };
  };

  const canBatchBorderFragment = (
    node: VisualRuntimeNode,
    side: "top" | "right" | "bottom" | "left",
    reference: VisualRuntimeNode,
  ): boolean => {
    if (borderFragmentSide(node) !== side || node.content.kind !== "path" || reference.content.kind !== "path") {
      return false;
    }
    const content = node.content;
    const referenceContent = reference.content;
    return (
      nodeIsActive(node, time) &&
      node.clipPath === undefined &&
      node.mask === undefined &&
      (node.blendMode === undefined || node.blendMode === "normal") &&
      content.effects === undefined &&
      content.stroke === undefined &&
      content.fill !== undefined &&
      content.fillPaint === undefined &&
      content.fill === referenceContent.fill &&
      content.fillOpacity === referenceContent.fillOpacity &&
      node.opacity === reference.opacity &&
      node.visible === reference.visible &&
      node.timing.start === reference.timing.start &&
      node.timing.duration === reference.timing.duration &&
      isTranslationOnlyMatrix(node.localMatrix) &&
      content.contours.every((contour) => contour.pathLength === undefined)
    );
  };

  const emitBorderBatch = (
    parent: VisualRuntimeNode,
    fragments: VisualRuntimeNode[],
  ): void => {
    const first = fragments[0]!;
    if (first.content.kind !== "path" || parent.content.kind !== "group") return;
    const contours = fragments.flatMap((fragment) => {
      if (fragment.content.kind !== "path") return [];
      return fragment.content.contours.map((contour) =>
        translatePathContour(contour, fragment.localMatrix, `${fragment.id}:${contour.id}`),
      );
    });
    if (contours.length === 0) return;
    const key = `${parent.id}:border-batch:${borderFragmentSide(first)}`;
    commands.push({
      op: "setTransform",
      key,
      matrix4: matrix4ToArray(parent.worldMatrix),
      alpha: first.opacity,
      visible: true,
      order: first.order,
    });
    commands.push({
      op: "drawPath",
      key,
      layerId: parent.id,
      contours,
      width: parent.content.width,
      height: parent.content.height,
      fillRule: "nonzero",
      fill: first.content.fill,
      ...(first.content.fillOpacity !== undefined
        ? { fillOpacity: first.content.fillOpacity }
        : {}),
    });
  };

  const emitNode = (node: VisualRuntimeNode): void => {
    if (!nodeIsActive(node, time)) return;
    if (node.content.kind !== "group") {
      // Semantic clip/mask definitions are compiled as sibling source nodes
      // under their target. Drawable layers need the same compositing scope as
      // groups so image/video/path/shape clips are applied before the content
      // is painted. Previously only group nodes entered this path, which made
      // Protocol V2 image clipPaths silently disappear at runtime.
      if (node.clipPath !== undefined || node.mask !== undefined || node.backdropEffects !== undefined) {
        commands.push({
          op: "beginLayer",
          key: node.id,
          layerId: node.id,
          isolation: true,
          offscreen: true,
          // The drawable below still owns its opacity/blend/effect semantics;
          // this scope exists only to install the semantic clip/mask.
          compositeAlpha: 1,
          ...(node.backdropEffects ? { backdropEffectProgram: buildRuntimeEffectProgram(node.backdropEffects) } : {}),
          ...(node.clipPath
            ? {
                clipPath: {
                  sourceKey: node.clipPath.sourceId,
                  ...(node.clipPath.sourceIds ? { sourceKeys: node.clipPath.sourceIds } : {}),
                },
              }
            : {}),
          ...(node.mask
            ? {
                mask: {
                  mode: node.mask.mode,
                  sourceKey: node.mask.sourceId,
                  ...(node.mask.sourceIds ? { sourceKeys: node.mask.sourceIds } : {}),
                  ...(node.mask.layers ? { composites: node.mask.layers.map((layer) => layer.composite) } : {}),
                  ...(node.mask.layers ? { layers: node.mask.layers.map((layer) => ({ mode: layer.mode, sourceKeys: layer.sourceIds, composite: layer.composite })) } : {}),
                },
              }
            : {}),
        });
        for (const child of childrenOf(node.id)) emitNode(child);
        emitDrawable(node);
        commands.push({ op: "endLayer", key: node.id });
      } else {
        emitDrawable(node);
      }
      return;
    }
    if (!subtreeHasActiveDrawable(node)) return;
    const children = childrenOf(node.id);
    const effectProgram = buildRuntimeEffectProgram(node.content.effects);
    const backdropEffectProgram = buildRuntimeEffectProgram(node.backdropEffects);
    const needsIsolation =
      node.opacity < 1 ||
      node.clipPath !== undefined ||
      node.mask !== undefined ||
      node.isolation === "isolate" ||
      node.blendMode !== undefined && node.blendMode !== "normal" ||
      effectProgram !== undefined ||
      backdropEffectProgram !== undefined;
    if (needsIsolation) {
      commands.push({
        op: "beginLayer",
        key: node.id,
        layerId: node.id,
        isolation: true,
        offscreen: true,
        compositeAlpha: node.opacity,
        blendMode: node.blendMode,
        ...(effectProgram ? { effectProgram } : {}),
        ...(effectProgram ? (() => {
          const effectBox = effectBoxFor(node, children);
          return effectBox ? { effectBox } : {};
        })() : {}),
        ...(backdropEffectProgram ? { backdropEffectProgram } : {}),
        ...(node.clipPath
          ? {
              clipPath: {
                sourceKey: node.clipPath.sourceId,
                ...(node.clipPath.sourceIds ? { sourceKeys: node.clipPath.sourceIds } : {}),
              },
            }
          : {}),
        ...(node.mask
          ? {
              mask: {
                mode: node.mask.mode,
                sourceKey: node.mask.sourceId,
                ...(node.mask.sourceIds ? { sourceKeys: node.mask.sourceIds } : {}),
                ...(node.mask.layers ? { composites: node.mask.layers.map((layer) => layer.composite) } : {}),
                ...(node.mask.layers ? { layers: node.mask.layers.map((layer) => ({ mode: layer.mode, sourceKeys: layer.sourceIds, composite: layer.composite })) } : {}),
              },
            }
          : {}),
      });
    } else {
      commands.push({ op: "beginGroup", key: node.id, layerId: node.id });
    }
    for (let index = 0; index < children.length;) {
      const child = children[index]!;
      const side = borderFragmentSide(child);
      if (
        side !== undefined &&
        child.content.kind === "path" &&
        canBatchBorderFragment(child, side, child)
      ) {
        const batch = [child];
        let next = index + 1;
        while (
          next < children.length &&
          canBatchBorderFragment(children[next]!, side, child)
        ) {
          batch.push(children[next]!);
          next += 1;
        }
        if (batch.length > 1) {
          emitBorderBatch(node, batch);
          index = next;
          continue;
        }
      }
      emitNode(child);
      index += 1;
    }
    commands.push(needsIsolation
      ? { op: "endLayer", key: node.id }
      : { op: "endGroup", key: node.id });
  };

  for (const node of childrenOf(null)) emitNode(node);

  commands.push({ op: "endFrame" });
  return {
    runtimeFormat: "motion-runtime",
    runtimeVersion: 2,
    frame,
    time,
    version: 1,
    commands,
    diagnostics,
  };
}

