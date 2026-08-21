/**
 * Validate PaintCommandBuffer invariants before decode/paint.
 */

import type { PaintCommand } from "./paint-command";
import type { PaintCommandBuffer } from "./paint-buffer";
import { PAINT_COMMAND_VERSION } from "./paint-buffer";
import type { PaintValidateIssue, PaintValidateResult } from "./paint-display-list";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHttpOrDataOrRelativeUri(uri: string): boolean {
  if (uri.startsWith("/") || uri.startsWith("./") || uri.startsWith("../")) {
    return true;
  }
  try {
    const parsed = new URL(uri);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "data:" ||
      parsed.protocol === "blob:" ||
      parsed.protocol === "file:"
    );
  } catch {
    return false;
  }
}

function matrix4Finite(matrix: unknown): boolean {
  return (
    Array.isArray(matrix) &&
    matrix.length === 16 &&
    matrix.every(isFiniteNumber)
  );
}

function isFit(value: unknown): boolean {
  return (
    value === undefined ||
    value === "contain" ||
    value === "cover" ||
    value === "fill" ||
    value === "none"
  );
}

/**
 * Structural + semantic checks on a paint command stream.
 * Does not mutate the buffer.
 */
export function validatePaintCommandBuffer(
  buffer: PaintCommandBuffer,
): PaintValidateResult {
  const issues: PaintValidateIssue[] = [];

  const version = buffer.version ?? PAINT_COMMAND_VERSION;
  if (version !== PAINT_COMMAND_VERSION) {
    issues.push({
      severity: "error",
      code: "paint_version_mismatch",
      message: `Expected paint version ${PAINT_COMMAND_VERSION}, got ${String(buffer.version)}`,
    });
  }

  const commands = buffer.commands;
  if (commands.length === 0) {
    issues.push({
      severity: "error",
      code: "empty_buffer",
      message: "PaintCommandBuffer has no commands",
    });
    return { ok: false, issues };
  }

  let beginCount = 0;
  let endCount = 0;
  const groupStack: string[] = [];
  const layerStack: string[] = [];
  const pendingTransform = new Map<string, number>();
  const drawKeys = new Set<string>();
  const transformKeysUsed = new Set<string>();

  for (let index = 0; index < commands.length; index += 1) {
    const cmd = commands[index]!;
    switch (cmd.op) {
      case "beginFrame": {
        beginCount += 1;
        if (index !== 0) {
          issues.push({
            severity: "error",
            code: "begin_frame_not_first",
            message: "beginFrame must be the first command",
          });
        }
        if (!isFiniteNumber(cmd.width) || cmd.width <= 0) {
          issues.push({
            severity: "error",
            code: "invalid_frame_size",
            message: `Invalid frame width: ${String(cmd.width)}`,
          });
        }
        if (!isFiniteNumber(cmd.height) || cmd.height <= 0) {
          issues.push({
            severity: "error",
            code: "invalid_frame_size",
            message: `Invalid frame height: ${String(cmd.height)}`,
          });
        }
        if (!cmd.projection || !matrix4Finite(cmd.projection.worldToClipMatrix)) {
          issues.push({
            severity: "error",
            code: "invalid_projection_matrix",
            message: "Projection worldToClipMatrix must contain exactly 16 finite values",
          });
        }
        break;
      }
      case "endFrame": {
        endCount += 1;
        if (index !== commands.length - 1) {
          issues.push({
            severity: "error",
            code: "end_frame_not_last",
            message: "endFrame must be the last command",
          });
        }
        break;
      }
      case "beginGroup": {
        groupStack.push(cmd.key);
        // Group markers may carry a world transform without a draw op.
        if (pendingTransform.has(cmd.key)) {
          transformKeysUsed.add(cmd.key);
          pendingTransform.delete(cmd.key);
        }
        break;
      }
      case "endGroup": {
        const open = groupStack.pop();
        if (open !== cmd.key) {
          issues.push({
            severity: "error",
            code: "group_scope_mismatch",
            message: `endGroup key "${cmd.key}" does not match open "${open ?? "<empty>"}"`,
            key: cmd.key,
          });
        }
        break;
      }
      case "beginLayer": {
        layerStack.push(cmd.key);
        break;
      }
      case "endLayer": {
        const open = layerStack.pop();
        if (open !== cmd.key) {
          issues.push({
            severity: "error",
            code: "layer_scope_mismatch",
            message: `endLayer key "${cmd.key}" does not match open "${open ?? "<empty>"}"`,
            key: cmd.key,
          });
        }
        break;
      }
      case "setTransform": {
        if (!matrix4Finite(cmd.matrix4)) {
          issues.push({
            severity: "error",
            code: "invalid_transform_matrix",
            message: `Transform for "${cmd.key}" must contain exactly 16 finite Matrix4 values`,
            key: cmd.key,
          });
        }
        if (!isFiniteNumber(cmd.alpha)) {
          issues.push({
            severity: "error",
            code: "non_finite_alpha",
            message: `Alpha for "${cmd.key}" is not finite`,
            key: cmd.key,
          });
        }
        pendingTransform.set(cmd.key, index);
        break;
      }
      case "drawText":
      case "drawShape":
      case "drawSolid":
      case "drawImage":
      case "drawPath":
      case "drawVideo":
      case "unsupported": {
        if (drawKeys.has(cmd.key)) {
          issues.push({
            severity: "error",
            code: "duplicate_draw_key",
            message: `Duplicate draw key "${cmd.key}" in frame`,
            key: cmd.key,
          });
        }
        drawKeys.add(cmd.key);
        if (!pendingTransform.has(cmd.key)) {
          issues.push({
            severity: "error",
            code: "missing_transform",
            message: `Draw op "${cmd.op}" for "${cmd.key}" has no matching setTransform`,
            key: cmd.key,
          });
        } else {
          transformKeysUsed.add(cmd.key);
          pendingTransform.delete(cmd.key);
        }
        if (
          (cmd.op === "drawShape" ||
            cmd.op === "drawSolid" ||
            cmd.op === "drawImage" ||
            cmd.op === "drawText" ||
            cmd.op === "drawVideo") &&
          ("width" in cmd || "height" in cmd)
        ) {
          const width = "width" in cmd ? cmd.width : undefined;
          const height = "height" in cmd ? cmd.height : undefined;
          if (width !== undefined && (!isFiniteNumber(width) || width < 0)) {
            issues.push({
              severity: "error",
              code: "invalid_draw_size",
              message: `Invalid width for "${cmd.key}"`,
              key: cmd.key,
            });
          }
          if (height !== undefined && (!isFiniteNumber(height) || height < 0)) {
            issues.push({
              severity: "error",
              code: "invalid_draw_size",
              message: `Invalid height for "${cmd.key}"`,
              key: cmd.key,
            });
          }
        }
        if (
          (cmd.op === "drawImage" || cmd.op === "drawVideo") &&
          cmd.uri &&
          !isHttpOrDataOrRelativeUri(cmd.uri)
        ) {
          issues.push({
            severity: "error",
            code: "invalid_uri_policy",
            message: `URI policy rejected for "${cmd.key}": ${cmd.uri}`,
            key: cmd.key,
          });
        }
        if (
          (cmd.op === "drawImage" || cmd.op === "drawVideo") &&
          !isFit(cmd.fit)
        ) {
          issues.push({
            severity: "error",
            code: "invalid_media_fit",
            message: `Invalid fit for "${cmd.key}"`,
            key: cmd.key,
          });
        }
        if (cmd.op === "drawImage" && cmd.crop) {
          const { x, y, width, height } = cmd.crop;
          const cropOk =
            isFiniteNumber(x) &&
            isFiniteNumber(y) &&
            isFiniteNumber(width) &&
            isFiniteNumber(height) &&
            x >= 0 &&
            y >= 0 &&
            width > 0 &&
            height > 0 &&
            x + width <= 1 &&
            y + height <= 1;
          if (!cropOk) {
            issues.push({
              severity: "error",
              code: "invalid_media_crop",
              message: `Invalid crop window for "${cmd.key}"`,
              key: cmd.key,
            });
          }
        }
        if (cmd.op === "drawVideo" && !isFiniteNumber(cmd.mediaTime)) {
          issues.push({
            severity: "error",
            code: "invalid_media_time",
            message: `Invalid mediaTime for "${cmd.key}"`,
            key: cmd.key,
          });
        }
        if (cmd.op === "drawPath" && cmd.mesh) {
          const mesh = cmd.mesh;
          const verticesOk =
            mesh.vertices.length >= 6 &&
            mesh.vertices.length % 2 === 0 &&
            mesh.vertices.every(isFiniteNumber);
          const indicesOk =
            mesh.indices.length >= 3 &&
            mesh.indices.length % 3 === 0 &&
            mesh.indices.every(
              (value) =>
                Number.isSafeInteger(value) &&
                value >= 0 &&
                value < mesh.vertices.length / 2,
            );
          const boundsOk = Object.values(mesh.bounds).every(isFiniteNumber);
          if (!verticesOk || !indicesOk || !boundsOk) {
            issues.push({
              severity: "error",
              code: "invalid_path_mesh",
              message: `Invalid Runtime-resolved path mesh for "${cmd.key}"`,
              key: cmd.key,
            });
          }
        }
        if (cmd.op === "drawPath" && cmd.strokeMesh) {
          const mesh = cmd.strokeMesh;
          const verticesOk =
            mesh.vertices.length >= 6 &&
            mesh.vertices.length % 2 === 0 &&
            mesh.vertices.every(isFiniteNumber);
          const indicesOk =
            mesh.indices.length >= 3 &&
            mesh.indices.length % 3 === 0 &&
            mesh.indices.every(
              (value) =>
                Number.isSafeInteger(value) &&
                value >= 0 &&
                value < mesh.vertices.length / 2,
            );
          const boundsOk = Object.values(mesh.bounds).every(isFiniteNumber);
          if (!verticesOk || !indicesOk || !boundsOk) {
            issues.push({
              severity: "error",
              code: "invalid_path_stroke_mesh",
              message: `Invalid Runtime-resolved path stroke mesh for "${cmd.key}"`,
              key: cmd.key,
            });
          }
        }
        break;
      }
      default: {
        const _exhaustive: never = cmd;
        void _exhaustive;
        issues.push({
          severity: "error",
          code: "unknown_op",
          message: `Unknown paint op at index ${index}`,
        });
      }
    }
  }

  if (beginCount !== 1) {
    issues.push({
      severity: "error",
      code: "begin_frame_count",
      message: `Expected exactly one beginFrame, found ${beginCount}`,
    });
  }
  if (endCount !== 1) {
    issues.push({
      severity: "error",
      code: "end_frame_count",
      message: `Expected exactly one endFrame, found ${endCount}`,
    });
  }
  if (groupStack.length > 0) {
    issues.push({
      severity: "error",
      code: "unclosed_group",
      message: `Unclosed beginGroup: ${groupStack.join(", ")}`,
    });
  }
  if (layerStack.length > 0) {
    issues.push({
      severity: "error",
      code: "unclosed_layer",
      message: `Unclosed beginLayer: ${layerStack.join(", ")}`,
    });
  }
  for (const [key] of pendingTransform) {
    issues.push({
      severity: "error",
      code: "orphan_transform",
      message: `setTransform without draw for key "${key}"`,
      key,
    });
  }
  void transformKeysUsed;

  const hasError = issues.some((issue) => issue.severity === "error");
  return hasError ? { ok: false, issues } : { ok: true, issues };
}

/** Type helper for exhaustive switches in painters. */
export function assertPaintCommand(command: PaintCommand): PaintCommand {
  return command;
}
