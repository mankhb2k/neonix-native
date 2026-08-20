import type { RuntimeProjectV2, RuntimeValidationV2 } from "./types";

function matrixIs4x4(value: unknown): boolean {
  return value instanceof Float64Array
    ? value.length === 16 && Array.from(value).every(Number.isFinite)
    : Array.isArray(value) && value.length === 16 && value.every(Number.isFinite);
}

export function validateRuntimeProjectV2(
  project: RuntimeProjectV2,
): RuntimeValidationV2 {
  const diagnostics: RuntimeValidationV2["diagnostics"] = [];
  if (project.format !== "motion-runtime" || project.formatVersion !== 2) {
    diagnostics.push({
      severity: "error",
      code: "runtime_v2_format",
      message: "Runtime project must use motion-runtime format version 2",
    });
  }
  if (
    !Number.isFinite(project.composition.width) ||
    project.composition.width <= 0 ||
    !Number.isFinite(project.composition.height) ||
    project.composition.height <= 0
  ) {
    diagnostics.push({
      severity: "error",
      code: "runtime_v2_composition_dimensions",
      message: "Runtime V2 composition dimensions must be finite and positive",
    });
  }
  if (!Number.isFinite(project.composition.fps) || project.composition.fps <= 0) {
    diagnostics.push({
      severity: "error",
      code: "runtime_v2_fps",
      message: "Runtime V2 composition fps must be finite and positive",
    });
  }
  for (const [name, matrix] of Object.entries(project.view)) {
    if (!matrixIs4x4(matrix)) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_view_matrix",
        message: `Runtime V2 view.${name} must be a finite 4x4 matrix`,
      });
    }
  }

  const ids = new Set<string>();
  for (const node of project.nodes) {
    if (ids.has(node.id)) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_duplicate_node",
        message: `Duplicate Runtime V2 node id: ${node.id}`,
        nodeId: node.id,
      });
    }
    ids.add(node.id);
    if (node.parentId !== null) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_parent_pending",
        message: "Runtime V2 shape slice only supports root nodes",
        nodeId: node.id,
      });
    }
    if (!matrixIs4x4(node.localMatrix) || !matrixIs4x4(node.worldMatrix)) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_node_matrix",
        message: "Runtime V2 node matrices must be finite 4x4 matrices",
        nodeId: node.id,
      });
    }
    if (
      !Number.isFinite(node.timing.start) ||
      node.timing.start < 0 ||
      !Number.isFinite(node.timing.duration) ||
      node.timing.duration <= 0
    ) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_timing",
        message: "Runtime V2 node timing must use a non-negative start and positive duration",
        nodeId: node.id,
      });
    }
    if (!Number.isFinite(node.opacity) || node.opacity < 0 || node.opacity > 1) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_opacity",
        message: "Runtime V2 node opacity must be within 0..1",
        nodeId: node.id,
      });
    }
    if (
      !Number.isFinite(node.content.width) ||
      node.content.width <= 0 ||
      !Number.isFinite(node.content.height) ||
      node.content.height <= 0
    ) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_shape_dimensions",
        message: "Runtime V2 shape dimensions must be finite and positive",
        nodeId: node.id,
      });
    }
  }
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics };
}
