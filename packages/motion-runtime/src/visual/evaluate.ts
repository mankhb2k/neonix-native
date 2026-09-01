import { frameToTime } from "../foundation/determinism";
import {
  identityMatrix4,
  matrix4ToArray,
  multiplyMatrix4,
  projectPoint3D,
  type Point3D,
} from "../geometry/matrix4";
import { tessellateNonScalingStroke } from "../geometry/path";
import type { PaintCommand } from "../paint/paint-command";
import { normalizeVisualRuntimeProject, validateVisualRuntimeProject } from "./validate";
import { buildRuntimeEffectProgram } from "./effects";
import type { VisualRuntimeFrame, VisualRuntimeNode, VisualRuntimeProject, VisualRuntimeVideo } from "./types";

function assertFrame(frame: number): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new Error("Runtime V2 frame must be a non-negative safe integer");
  }
}

function stableNodeOrder(nodes: VisualRuntimeNode[]): VisualRuntimeNode[] {
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
export function evaluateVisualRuntimeProject(
  project: VisualRuntimeProject,
  frame: number,
  options: { time?: number; outputScale?: number } = {},
): VisualRuntimeFrame {
  // Native VPS export inputProps cross a JSON boundary. Rehydrate Matrix4 values before
  // validation and arithmetic; otherwise serialized typed arrays are plain
  // objects without a numeric length and matrix operations produce NaN.
  project = normalizeVisualRuntimeProject(project);
  assertFrame(frame);
  const validation = validateVisualRuntimeProject(project);
  if (!validation.ok) {
    throw new Error(
      `Runtime V2 validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" | ")}`,
    );
  }
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
      },
    },
  ];
  const diagnostics = [] as NonNullable<VisualRuntimeFrame["diagnostics"]>;

  const childrenByParent = new Map<string | null, VisualRuntimeNode[]>();
  for (const node of project.nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  const childrenOf = (parentId: string | null) =>
    stableNodeOrder(childrenByParent.get(parentId) ?? []);
  const subtreeHasEffects = (node: VisualRuntimeNode): boolean => {
    if (node.content.kind !== "group") return (node.content.effects?.length ?? 0) > 0;
    return (node.content.effects?.length ?? 0) > 0 || childrenOf(node.id).some(subtreeHasEffects);
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
      projectPoint3D(nodeViewProjection, corner),
    );
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
    const blendMode = node.blendMode ?? "normal";
    if (effectProgram && blendMode !== "normal") {
      throw new Error(`Runtime V2 blend modes on an effected layer are not certified yet: ${node.id}`);
    }
    const blendIsolation = blendMode !== "normal";
    if (blendIsolation) {
      commands.push({
        op: "beginLayer",
        key: node.id,
        layerId: node.id,
        isolation: true,
        offscreen: true,
        compositeAlpha: node.opacity,
        blendMode,
      });
    } else if (effectProgram) {
      commands.push({
        op: "beginLayer",
        key: node.id,
        layerId: node.id,
        isolation: effectProgram.requiresOffscreen,
        offscreen: effectProgram.requiresOffscreen,
        effectProgram,
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
      if (effectProgram || blendIsolation) commands.push({ op: "endLayer", key: node.id });
      return;
    }
    commands.push({
      op: "setTransform",
      key: node.id,
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
        width: content.width,
        height: content.height,
        glyphs: content.layout!.glyphs,
        lines: content.layout!.lines,
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
    if (effectProgram || blendIsolation) {
      commands.push({ op: "endLayer", key: node.id });
    }
  };

  const emitNode = (node: VisualRuntimeNode): void => {
    if (!nodeIsActive(node, time)) return;
    if (node.content.kind !== "group") {
      emitDrawable(node);
      return;
    }
    if (!subtreeHasActiveDrawable(node)) return;
    const effectProgram = buildRuntimeEffectProgram(node.content.effects);
    const needsIsolation =
      node.opacity < 1 ||
      node.clipPath !== undefined ||
      node.mask !== undefined ||
      node.isolation === "isolate" ||
      node.blendMode !== undefined && node.blendMode !== "normal" ||
      effectProgram !== undefined;
    if (needsIsolation && !effectProgram && childrenOf(node.id).some(subtreeHasEffects)) {
      throw new Error(`Runtime V2 cannot place effects inside an isolated group yet: ${node.id}`);
    }
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
              },
            }
          : {}),
      });
    } else {
      commands.push({ op: "beginGroup", key: node.id, layerId: node.id });
    }
    for (const child of childrenOf(node.id)) {
      emitNode(child);
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

