import { validatePaintCommandBuffer } from "../paint/validate-paint-command-buffer";
import type {
  VisualRuntimeFrame,
  VisualRuntimeProject,
  VisualRuntimeValidation,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function serializedMatrixValues(value: unknown): number[] | undefined {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return undefined;
  const values = Array.from({ length: 16 }, (_, index) => value[String(index)]);
  return values.every((item) => typeof item === "number")
    ? values as number[]
    : undefined;
}

function normalizeMatrix4(value: unknown): unknown {
  if (value instanceof Float64Array) return value;
  const values = serializedMatrixValues(value);
  return values ? new Float64Array(values) : value;
}

/** Rehydrate matrices after JSON transport (for example Native VPS export inputProps). */
export function normalizeVisualRuntimeProject(input: VisualRuntimeProject): VisualRuntimeProject {
  const view = input.view;
  const nodes = input.nodes;
  const normalizedView = {
    ...view,
    worldToClipMatrix: normalizeMatrix4(view.worldToClipMatrix),
  };
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    localMatrix: normalizeMatrix4(node.localMatrix),
    worldMatrix: normalizeMatrix4(node.worldMatrix),
  }));
  const unchanged =
    normalizedView.worldToClipMatrix === view.worldToClipMatrix &&
    normalizedNodes.every((node, index) =>
      node.localMatrix === nodes[index]!.localMatrix &&
      node.worldMatrix === nodes[index]!.worldMatrix,
    );
  return unchanged
    ? input
    : ({ ...input, view: normalizedView, nodes: normalizedNodes } as VisualRuntimeProject);
}

/** Fast boundary check used by renderer consumers before deep validation. */
export function isVisualRuntimeProject(input: unknown): input is VisualRuntimeProject {
  if (!isRecord(input)) return false;
  const composition = input.composition;
  const view = input.view;
  return (
    input.format === "motion-runtime" &&
    input.formatVersion === 2 &&
    typeof input.id === "string" &&
    isRecord(composition) &&
    isRecord(view) &&
    Array.isArray(input.nodes)
  );
}

function validationError(prefix: string, diagnostics: VisualRuntimeValidation["diagnostics"]): Error {
  return new Error(
    `${prefix}: ${diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnostic.message)
      .join(" | ")}`,
  );
}

/** Fail-closed Runtime V2 project boundary for preview/export consumers. */
export function assertVisualRuntimeProject(input: unknown): VisualRuntimeProject {
  if (!isVisualRuntimeProject(input)) {
    throw new Error("Expected VisualRuntimeProject with motion-runtime format version 2");
  }
  const normalized = normalizeVisualRuntimeProject(input);
  const validation = validateVisualRuntimeProject(normalized);
  if (!validation.ok) throw validationError("Runtime V2 validation failed", validation.diagnostics);
  return normalized;
}

/** Fail-closed Runtime V2 frame boundary for preview consumers. */
export function assertVisualRuntimeFrame(input: unknown): asserts input is VisualRuntimeFrame {
  if (!isRecord(input)) {
    throw new Error("Expected VisualRuntimeFrame");
  }
  const frame = input.frame;
  const time = input.time;
  if (
    input.runtimeFormat !== "motion-runtime" ||
    input.runtimeVersion !== 2 ||
    typeof frame !== "number" ||
    !Number.isSafeInteger(frame) ||
    frame < 0 ||
    typeof time !== "number" ||
    !Number.isFinite(time) ||
    time < 0 ||
    !Array.isArray(input.commands) ||
    !Array.isArray(input.diagnostics)
  ) {
    throw new Error("Expected VisualRuntimeFrame with motion-runtime version 2");
  }
  const validation = validatePaintCommandBuffer(input as unknown as VisualRuntimeFrame);
  if (!validation.ok) {
    const details = validation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message)
      .join(" | ");
    throw new Error(`VisualRuntimeFrame paint validation failed: ${details}`);
  }
}

function matrixIs4x4(value: unknown): boolean {
  const values = serializedMatrixValues(value);
  return values !== undefined && values.length === 16 && values.every(Number.isFinite);
}

export function validateVisualRuntimeProject(
  project: VisualRuntimeProject,
): VisualRuntimeValidation {
  const diagnostics: VisualRuntimeValidation["diagnostics"] = [];
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
  if (
    project.composition.duration !== undefined &&
    (!Number.isFinite(project.composition.duration) || project.composition.duration < 0)
  ) {
    diagnostics.push({
      severity: "error",
      code: "runtime_v2_duration",
      message: "Runtime V2 composition duration must be finite and non-negative",
    });
  }
  if (!matrixIs4x4(project.view.worldToClipMatrix)) {
    diagnostics.push({
      severity: "error",
      code: "runtime_v2_view_matrix",
      message: "Runtime V2 view.worldToClipMatrix must be a finite 4x4 matrix",
    });
  }

  const ids = new Set<string>();
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
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
      const parent = nodeById.get(node.parentId);
      if (!parent || parent.content.kind !== "group") {
        diagnostics.push({
          severity: "error",
          code: "runtime_v2_parent_group",
          message: `Runtime V2 node ${node.id} must reference an existing Runtime group parent`,
          nodeId: node.id,
        });
      }
      const ancestry = new Set<string>([node.id]);
      let current: string | null = node.parentId;
      while (current !== null) {
        if (ancestry.has(current)) {
          diagnostics.push({
            severity: "error",
            code: "runtime_v2_parent_cycle",
            message: `Runtime V2 node ${node.id} is in a parent cycle`,
            nodeId: node.id,
          });
          break;
        }
        ancestry.add(current);
        current = nodeById.get(current)?.parentId ?? null;
      }
    }
    if (node.backfaceVisibility !== undefined && node.backfaceVisibility !== "visible" && node.backfaceVisibility !== "hidden") {
      diagnostics.push({ severity: "error", code: "runtime_v2_backface_visibility", message: "Runtime V2 backfaceVisibility is invalid", nodeId: node.id });
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
    if (node.content.kind === "image") {
      if (!node.content.assetId.trim()) {
        diagnostics.push({ severity: "error", code: "runtime_v2_image_asset", message: "Runtime V2 image assetId must be non-empty", nodeId: node.id });
      }
      if (![node.content.x, node.content.y, node.content.width, node.content.height].every(Number.isFinite) || node.content.width <= 0 || node.content.height <= 0) {
        diagnostics.push({ severity: "error", code: "runtime_v2_image_viewport", message: "Runtime V2 image viewport must have finite x/y and positive width/height", nodeId: node.id });
      }
      const aspect = node.content.preserveAspectRatio;
      if (aspect) {
        if (aspect.align && !["none", "xMinYMin", "xMidYMin", "xMaxYMin", "xMinYMid", "xMidYMid", "xMaxYMid", "xMinYMax", "xMidYMax", "xMaxYMax"].includes(aspect.align)) {
          diagnostics.push({ severity: "error", code: "runtime_v2_image_aspect_align", message: "Runtime V2 image preserveAspectRatio align is invalid", nodeId: node.id });
        }
        if (aspect.meetOrSlice && !["meet", "slice"].includes(aspect.meetOrSlice)) {
          diagnostics.push({ severity: "error", code: "runtime_v2_image_aspect_mode", message: "Runtime V2 image preserveAspectRatio mode is invalid", nodeId: node.id });
        }
      }
      if (node.content.imageRendering && !["auto", "optimizeQuality", "optimizeSpeed", "smooth", "high-quality", "crisp-edges", "pixelated"].includes(node.content.imageRendering)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_image_rendering", message: "Runtime V2 image imageRendering is invalid", nodeId: node.id });
      }
    }
    if (node.content.kind === "video") {
      if (!node.content.assetId.trim()) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_asset", message: "Runtime V2 video assetId must be non-empty", nodeId: node.id });
      }
      if (!Number.isFinite(node.content.trimStart) || node.content.trimStart < 0) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_trim_start", message: "Runtime V2 video trimStart must be non-negative", nodeId: node.id });
      }
      if (node.content.trimEnd !== undefined && (!Number.isFinite(node.content.trimEnd) || node.content.trimEnd <= node.content.trimStart)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_trim_end", message: "Runtime V2 video trimEnd must be greater than trimStart", nodeId: node.id });
      }
      if (node.content.sourceDuration !== undefined) {
        const sourceEnd = Math.min(node.content.trimEnd ?? node.content.sourceDuration, node.content.sourceDuration);
        const availableDuration = sourceEnd - node.content.trimStart;
        if (!Number.isFinite(node.content.sourceDuration) || node.content.sourceDuration <= 0 || availableDuration <= 0) {
          diagnostics.push({ severity: "error", code: "runtime_v2_video_source_range", message: "Runtime V2 video source range is invalid", nodeId: node.id });
        } else if (node.timing.duration > availableDuration) {
          diagnostics.push({ severity: "error", code: "runtime_v2_video_duration", message: "Runtime V2 video timing exceeds the selected source range", nodeId: node.id });
        }
      }
      if (!Number.isFinite(node.content.sourceFps) || node.content.sourceFps <= 0) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_fps", message: "Runtime V2 video sourceFps must be positive", nodeId: node.id });
      }
      if (!["floor", "round", "ceil"].includes(node.content.framePolicy)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_frame_policy", message: "Runtime V2 video framePolicy is invalid", nodeId: node.id });
      }
      if (node.content.fit && !["contain", "cover", "fill", "none"].includes(node.content.fit)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_video_fit", message: "Runtime V2 video fit is invalid", nodeId: node.id });
      }
    }
    if (node.content.kind === "text") {
      if (!node.content.fontAssetId.trim() || !node.content.fontUri.trim() || !node.content.fontIntegrity.trim()) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_font", message: "Runtime V2 text requires an exact font asset reference", nodeId: node.id });
      }
      if (![node.content.fontSize, node.content.lineHeight, node.content.letterSpacing].every(Number.isFinite) || node.content.fontSize <= 0 || node.content.lineHeight <= 0) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_metrics", message: "Runtime V2 text metrics are invalid", nodeId: node.id });
      }
      if (!['left', 'center', 'right'].includes(node.content.align) || !['top', 'middle', 'bottom'].includes(node.content.verticalAlign)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_alignment", message: "Runtime V2 text alignment is invalid", nodeId: node.id });
      }
      if (node.content.wrap !== "none" || node.content.overflow !== "visible" || !["ltr", "rtl"].includes(node.content.direction)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_mvp_contract", message: "Runtime V2 text must use the certified MVP layout contract", nodeId: node.id });
      }
      if (node.content.writingMode && !["horizontal-tb", "vertical-rl", "vertical-lr"].includes(node.content.writingMode)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_writing_mode", message: "Runtime V2 text writing mode is invalid", nodeId: node.id });
      }
      if (node.content.layout && (!Number.isSafeInteger(node.content.layout.unitsPerEm) || node.content.layout.unitsPerEm <= 0)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_text_layout", message: "Runtime V2 text layout unitsPerEm is invalid", nodeId: node.id });
      }
    }
    if (node.content.kind === "path") {
      if (node.content.fillRule !== "nonzero" && node.content.fillRule !== "evenodd") {
        diagnostics.push({
          severity: "error",
          code: "runtime_v2_path_fill_rule",
          message: "Runtime V2 path fillRule must be nonzero or evenodd",
          nodeId: node.id,
        });
      }
      if (node.content.fill !== undefined) {
        const mesh = node.content.mesh;
        const verticesAreValid = !!mesh && mesh.vertices.length >= 6 && mesh.vertices.length % 2 === 0 && mesh.vertices.every(Number.isFinite);
        const indicesAreValid = !!mesh && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0 && mesh.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < mesh.vertices.length / 2);
        if (!verticesAreValid || !indicesAreValid) {
          diagnostics.push({
            severity: "error",
            code: "runtime_v2_path_mesh",
            message: "Runtime V2 filled path must contain finite XY vertices and triangle indices",
            nodeId: node.id,
          });
        }
      }
      if (node.content.stroke !== undefined) {
        const strokeWidth = node.content.strokeWidth;
        if (strokeWidth === undefined || !Number.isFinite(strokeWidth) || strokeWidth <= 0) {
          diagnostics.push({
            severity: "error",
            code: "runtime_v2_path_stroke_width",
            message: "Runtime V2 path strokeWidth must be finite and positive when stroke is present",
            nodeId: node.id,
          });
        }
        const strokeMesh = node.content.strokeMesh;
        const strokeVerticesAreValid = !!strokeMesh && strokeMesh.vertices.length >= 6 && strokeMesh.vertices.length % 2 === 0 && strokeMesh.vertices.every(Number.isFinite);
        const strokeIndicesAreValid = !!strokeMesh && strokeMesh.indices.length >= 3 && strokeMesh.indices.length % 3 === 0 && strokeMesh.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < strokeMesh.vertices.length / 2);
        if (!strokeVerticesAreValid || !strokeIndicesAreValid) {
          diagnostics.push({
            severity: "error",
            code: "runtime_v2_path_stroke_mesh",
            message: "Runtime V2 stroked path must contain finite stroke mesh vertices and triangle indices",
            nodeId: node.id,
          });
        }
      }
      if (node.content.strokeJoin && !["miter", "bevel", "round"].includes(node.content.strokeJoin)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_path_stroke_join", message: "Runtime V2 path strokeJoin is invalid", nodeId: node.id });
      }
      if (node.content.strokeCap && !["butt", "square", "round"].includes(node.content.strokeCap)) {
        diagnostics.push({ severity: "error", code: "runtime_v2_path_stroke_cap", message: "Runtime V2 path strokeCap is invalid", nodeId: node.id });
      }
      if (node.content.strokeDash) {
        if (node.content.strokeDash.array.length === 0 || !node.content.strokeDash.array.every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(node.content.strokeDash.offset)) {
          diagnostics.push({ severity: "error", code: "runtime_v2_path_stroke_dash", message: "Runtime V2 path strokeDash is invalid", nodeId: node.id });
        }
      }
      if (node.content.paintOrder) {
        const allowed = new Set(["fill", "stroke", "markers"]);
        if (
          node.content.paintOrder.length === 0 ||
          node.content.paintOrder.length > 3 ||
          node.content.paintOrder.some((item) => !allowed.has(item)) ||
          new Set(node.content.paintOrder).size !== node.content.paintOrder.length
        ) {
          diagnostics.push({
            severity: "error",
            code: "runtime_v2_paint_order",
            message: "Runtime V2 paintOrder must contain unique fill, stroke, and markers items",
            nodeId: node.id,
          });
        }
      }
      if (node.content.markers) {
        for (const marker of node.content.markers) {
          if (!marker.id.trim() || !["start", "mid", "end"].includes(marker.placement)) {
            diagnostics.push({ severity: "error", code: "runtime_v2_path_marker_identity", message: "Runtime V2 path marker identity is invalid", nodeId: node.id });
          }
          if (marker.fill !== undefined) {
            const mesh = marker.mesh;
            const valid = !!mesh && mesh.vertices.length >= 6 && mesh.vertices.length % 2 === 0 && mesh.vertices.every(Number.isFinite) && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0 && mesh.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < mesh.vertices.length / 2);
            if (!valid) diagnostics.push({ severity: "error", code: "runtime_v2_path_marker_mesh", message: "Runtime V2 filled marker must contain a valid mesh", nodeId: node.id });
          }
          if (marker.stroke !== undefined && (marker.strokeWidth === undefined || !Number.isFinite(marker.strokeWidth) || marker.strokeWidth <= 0 || !marker.strokeMesh)) {
            diagnostics.push({ severity: "error", code: "runtime_v2_path_marker_stroke", message: "Runtime V2 stroked marker must contain a positive width and mesh", nodeId: node.id });
          }
          if (marker.paintOrder.length === 0 || marker.paintOrder.some((item) => !["fill", "stroke", "markers"].includes(item))) {
            diagnostics.push({ severity: "error", code: "runtime_v2_path_marker_paint_order", message: "Runtime V2 marker paintOrder is invalid", nodeId: node.id });
          }
        }
      }
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
      node.blendMode !== undefined &&
      ![
        "normal",
        "darken",
        "multiply",
        "color-burn",
        "lighten",
        "screen",
        "color-dodge",
        "overlay",
        "soft-light",
        "hard-light",
        "difference",
        "exclusion",
        "hue",
        "saturation",
        "color",
        "luminosity",
      ].includes(node.blendMode)
    ) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_blend_mode",
        message: "Runtime V2 blendMode must be a CSS canonical blend mode",
        nodeId: node.id,
      });
    }
    if (node.isolation !== undefined && !["auto", "isolate"].includes(node.isolation)) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_isolation",
        message: "Runtime V2 isolation must be auto or isolate",
        nodeId: node.id,
      });
    }
    if (node.mask !== undefined) {
      const sourceIds = node.mask.sourceIds ?? [node.mask.sourceId];
      const sources = sourceIds.map((sourceId) => nodeById.get(sourceId));
      if (
        node.content.kind !== "group" ||
        !["clip", "alpha", "luma"].includes(node.mask.mode) ||
        sources.some((source) => !source || source.parentId !== node.id || source.content.kind === "group") ||
        // Compiler V2 lowers protocol shapes to path geometry, so clip masks
        // sourced from a Shape are validated at the runtime path boundary.
        sources.some((source) => node.mask!.mode === "clip" && source!.content.kind !== "path")
      ) {
        diagnostics.push({
          severity: "error",
          code: "runtime_v2_mask",
          message: "Runtime V2 mask must reference a valid direct child of a group",
          nodeId: node.id,
        });
      }
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

