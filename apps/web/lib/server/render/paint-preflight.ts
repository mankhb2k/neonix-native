/**
 * Export / paint preflight — fail closed before Lambda spend.
 */

import {
  PAINT_COMMAND_VERSION,
  decodePaintCommandBuffer,
  getPaintOpCapability,
  resolvePaintFallback,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import type { RenderManifest } from "@motionvideo/render-contracts";

export type PaintPreflightIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type PaintPreflightResult = {
  ok: boolean;
  issues: PaintPreflightIssue[];
};

export type PreflightAsset = {
  id: string;
  uri: string;
  mimeType: string;
  integrity?: string;
  sha256?: string;
};

export function preflightPaintCommandBuffer(
  paint: PaintCommandBuffer,
): PaintPreflightResult {
  const issues: PaintPreflightIssue[] = [];
  const version = paint.version ?? PAINT_COMMAND_VERSION;
  if (version !== PAINT_COMMAND_VERSION) {
    issues.push({
      severity: "error",
      code: "paint_version_mismatch",
      message: `Paint version ${String(paint.version)} != ${String(PAINT_COMMAND_VERSION)}`,
    });
  }

  try {
    const list = decodePaintCommandBuffer(paint);
    for (const diag of list.diagnostics) {
      if (diag.severity === "error" || diag.code === "unsupported_node_type") {
        issues.push({
          severity: "error",
          code: diag.code,
          message: diag.message,
        });
      }
    }
  } catch (err) {
    issues.push({
      severity: "error",
      code: "paint_decode_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  for (const cmd of paint.commands) {
    if (cmd.op === "unsupported") {
      issues.push({
        severity: "error",
        code: "unsupported_paint_op",
        message: cmd.message,
      });
      continue;
    }
    const cap = getPaintOpCapability(cmd.op);
    if (!cap) continue;
    if (
      resolvePaintFallback(cmd.op, "export") === "fail" &&
      cap.remotion === "no"
    ) {
      issues.push({
        severity: "error",
        code: "capability_unsupported",
        message: `Op ${cmd.op} unsupported for remotion export`,
      });
    }
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

export function preflightRenderManifest(
  manifest: RenderManifest,
  options?: {
    paint?: PaintCommandBuffer;
    assets?: PreflightAsset[];
    requireProductionGate?: boolean;
  },
): PaintPreflightResult {
  const issues: PaintPreflightIssue[] = [];

  if (!manifest.composition.width || !manifest.composition.height) {
    issues.push({
      severity: "error",
      code: "invalid_composition_size",
      message: "Composition width/height required",
    });
  }
  if (manifest.composition.durationInFrames < 1) {
    issues.push({
      severity: "error",
      code: "invalid_duration",
      message: "durationInFrames must be >= 1",
    });
  }

  if (options?.paint) {
    const paintResult = preflightPaintCommandBuffer(options.paint);
    issues.push(...paintResult.issues);
  }

  if (options?.assets) {
    for (const asset of options.assets) {
      if (!asset.uri) {
        issues.push({
          severity: "error",
          code: "asset_uri_missing",
          message: `Asset ${asset.id} missing uri`,
        });
      }
      if (options.requireProductionGate && !asset.integrity && !asset.sha256) {
        issues.push({
          severity: "error",
          code: "asset_integrity_missing",
          message: `Asset ${asset.id} missing integrity for production gate`,
        });
      }
    }
  }

  if (options?.requireProductionGate) {
    const hasErrors = issues.some((i) => i.severity === "error");
    if (hasErrors) {
      issues.push({
        severity: "error",
        code: "production_gate_blocked",
        message:
          "Production export blocked until MVP visual gate / preflight pass",
      });
    }
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}
