import { frameToTime } from "../determinism";
import { matrix4ToArray } from "../matrix4";
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
  const time = frameToTime(frame, project.composition.fps);
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
        viewMatrix: matrix4ToArray(project.view.viewMatrix),
        projectionMatrix: matrix4ToArray(project.view.projectionMatrix),
        viewProjectionMatrix: matrix4ToArray(project.view.viewProjectionMatrix),
      },
    },
  ];

  for (const node of stableNodeOrder(project)) {
    const active =
      node.visible &&
      node.opacity > 0 &&
      time >= node.timing.start &&
      time < node.timing.start + node.timing.duration;
    if (!active) continue;

    commands.push({
      op: "setTransform",
      key: node.id,
      matrix: node.matrix2D,
      matrix4: matrix4ToArray(node.worldMatrix),
      alpha: node.opacity,
      visible: true,
      zIndex: node.zIndex,
    });
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

  commands.push({ op: "endFrame" });
  return {
    runtimeFormat: "motion-runtime",
    runtimeVersion: 2,
    frame,
    time,
    version: 1,
    commands,
    diagnostics: [],
  };
}
