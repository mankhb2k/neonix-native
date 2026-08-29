import { frameToTime } from "../../determinism";
import {
  matrix4ToArray,
  multiplyMatrix4,
  projectPoint3D,
  type Point3D,
} from "../../matrix4";
import type { PaintCommand } from "../../paint";
import { validateVisualRuntimeProject } from "./validate";
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
  options: { time?: number } = {},
): VisualRuntimeFrame {
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
    return childrenOf(node.id).some(subtreeHasEffects);
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
    if (effectProgram) {
      commands.push({
        op: "beginLayer",
        key: node.id,
        layerId: node.id,
        isolation: effectProgram.requiresOffscreen,
        offscreen: effectProgram.requiresOffscreen,
        effectProgram,
      });
    }
    commands.push({
      op: "setTransform",
      key: node.id,
      matrix4: matrix4ToArray(node.worldMatrix),
      alpha: node.opacity,
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
        mesh: content.mesh,
        ...(content.strokeMesh ? { strokeMesh: content.strokeMesh } : {}),
        fillRule: content.fillRule,
        ...(content.fill ? { fill: content.fill } : {}),
        ...(content.fillOpacity != null
          ? { fillOpacity: content.fillOpacity }
          : {}),
        ...(content.stroke ? { stroke: content.stroke } : {}),
        ...(content.strokeWidth != null
          ? { strokeWidth: content.strokeWidth }
          : {}),
        ...(content.strokeOpacity != null
          ? { strokeOpacity: content.strokeOpacity }
          : {}),
        ...(content.strokeJoin ? { strokeJoin: content.strokeJoin } : {}),
        ...(content.strokeCap ? { strokeCap: content.strokeCap } : {}),
        ...(content.strokeDash ? { strokeDash: content.strokeDash } : {}),
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
        width: content.width,
        height: content.height,
        ...(content.fit ? { fit: content.fit } : {}),
        ...(content.crop ? { crop: content.crop } : {}),
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
        ...(content.strokeWidth != null
          ? { strokeWidth: content.strokeWidth }
          : {}),
        ...(content.strokeOpacity != null
          ? { strokeOpacity: content.strokeOpacity }
          : {}),
      });
    }
    if (effectProgram) {
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
    const needsIsolation = node.opacity < 1 || node.mask !== undefined;
    if ((node.blendMode ?? "normal") !== "normal") {
      throw new Error(`Runtime V2 group blend modes are not certified yet: ${node.id}`);
    }
    if (needsIsolation && subtreeHasEffects(node)) {
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
        ...(node.mask
          ? {
              mask: {
                mode: node.mask.mode,
                sourceKey: node.mask.sourceId,
                sourceVisibility: "mask-only" as const,
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
