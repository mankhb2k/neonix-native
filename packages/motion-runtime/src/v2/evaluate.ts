import { frameToTime } from "../determinism";
import {
  matrix4ToArray,
  multiplyMatrix4,
  projectPoint3D,
  type Point3D,
} from "../matrix4";
import type { PaintCommand } from "../paint";
import { validateRuntimeProjectV2 } from "./validate";
import type { RuntimeFrameV2, RuntimeProjectV2 } from "./types";

function assertFrame(frame: number): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new Error("Runtime V2 frame must be a non-negative safe integer");
  }
}

function stableNodeOrder(project: RuntimeProjectV2): RuntimeProjectV2["nodes"] {
  return [...project.nodes].sort(
    (left, right) =>
      left.zIndex - right.zIndex ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}

/**
 * Evaluate the V2 runtime scene into the backend-neutral paint contract.
 *
 * This first slice intentionally handles only certified shape atoms. Matrix
 * calculation belongs to Compiler B; this evaluator only resolves active
 * windows, stable order, and the already-resolved runtime matrices.
 */
export function evaluateRuntimeProjectV2(
  project: RuntimeProjectV2,
  frame: number,
  options: { time?: number } = {},
): RuntimeFrameV2 {
  assertFrame(frame);
  const validation = validateRuntimeProjectV2(project);
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
  const diagnostics = [] as NonNullable<RuntimeFrameV2["diagnostics"]>;

  for (const node of stableNodeOrder(project)) {
    const active =
      node.visible &&
      node.opacity > 0 &&
      time >= node.timing.start &&
      time < node.timing.start + node.timing.duration;
    if (!active) continue;

    const nodeViewProjection = multiplyMatrix4(
      project.view.worldToClipMatrix,
      node.worldMatrix,
    );
    const localBounds = node.content.kind === "path"
      ? (() => {
          const bounds = [node.content.mesh?.bounds, node.content.strokeMesh?.bounds].filter(
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

    commands.push({
      op: "setTransform",
      key: node.id,
      matrix4: matrix4ToArray(node.worldMatrix),
      alpha: node.opacity,
      visible: true,
      zIndex: node.zIndex,
    });
    if (node.content.kind === "path") {
      commands.push({
        op: "drawPath",
        key: node.id,
        layerId: node.id,
        contours: node.content.contours,
        mesh: node.content.mesh,
        ...(node.content.strokeMesh ? { strokeMesh: node.content.strokeMesh } : {}),
        fillRule: node.content.fillRule,
        ...(node.content.fill ? { fill: node.content.fill } : {}),
        ...(node.content.fillOpacity != null
          ? { fillOpacity: node.content.fillOpacity }
          : {}),
        ...(node.content.stroke ? { stroke: node.content.stroke } : {}),
        ...(node.content.strokeWidth != null
          ? { strokeWidth: node.content.strokeWidth }
          : {}),
        ...(node.content.strokeOpacity != null
          ? { strokeOpacity: node.content.strokeOpacity }
          : {}),
        ...(node.content.strokeJoin ? { strokeJoin: node.content.strokeJoin } : {}),
        ...(node.content.strokeCap ? { strokeCap: node.content.strokeCap } : {}),
        ...(node.content.strokeDash ? { strokeDash: node.content.strokeDash } : {}),
      });
    } else {
      commands.push({
        op: "drawShape",
        key: node.id,
        layerId: node.id,
        shape: node.content.shape,
        fill: node.content.fill,
        width: node.content.width,
        height: node.content.height,
        ...(node.content.fillPaint ? { fillPaint: node.content.fillPaint } : {}),
        ...(node.content.fillOpacity != null
          ? { fillOpacity: node.content.fillOpacity }
          : {}),
        ...(node.content.cornerRadius != null
          ? { cornerRadius: node.content.cornerRadius }
          : {}),
        ...(node.content.stroke ? { stroke: node.content.stroke } : {}),
        ...(node.content.strokeWidth != null
          ? { strokeWidth: node.content.strokeWidth }
          : {}),
        ...(node.content.strokeOpacity != null
          ? { strokeOpacity: node.content.strokeOpacity }
          : {}),
      });
    }
  }

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
