/**
 * Paint buffer contract — versioning and validation entrypoint.
 *
 * This module is the public API for contract version checks and
 * paint buffer validation used by parity harness, export, and
 * worker protocols.
 *
 * §4 in core-engine-tasks.md, Task 4.4
 */

import { PAINT_COMMAND_VERSION } from "./paint-buffer";
import { validatePaintCommandBuffer } from "./validate-paint-command-buffer";
import type { PaintCommand } from "./paint-command";
import type { PaintCommandBuffer } from "./paint-buffer";
import type { PaintValidateResult } from "./paint-display-list";

// ── Public contract version ───────────────────────────────────────────

/**
 * The paint contract version used by the parity harness and export.
 * Must match the consumer side exactly. Bump when paint op semantics or
 * required fields change.
 */
export const paintContractVersion = PAINT_COMMAND_VERSION;

/** Stable command-stream summary for runtime diagnostics and regression tests. */
export type PaintCommandBufferSummary = {
  commandCount: number;
  operationCounts: Partial<Record<PaintCommand["op"], number>>;
  drawKeys: string[];
  transformKeys: string[];
  layerScopes: string[];
  groupScopes: string[];
};

export function summarizePaintCommandBuffer(
  buffer: PaintCommandBuffer,
): PaintCommandBufferSummary {
  const operationCounts: Partial<Record<PaintCommand["op"], number>> = {};
  const drawKeys: string[] = [];
  const transformKeys: string[] = [];
  const layerScopes: string[] = [];
  const groupScopes: string[] = [];

  for (const command of buffer.commands) {
    operationCounts[command.op] = (operationCounts[command.op] ?? 0) + 1;
    if (command.op === "setTransform") transformKeys.push(command.key);
    if (
      "key" in command &&
      (command.op === "drawText" || command.op === "drawShape" || command.op === "drawSolid" ||
        command.op === "drawImage" || command.op === "drawPath" || command.op === "drawVideo" ||
        command.op === "unsupported")
    ) {
      drawKeys.push(command.key);
    }
    if (command.op === "beginLayer" || command.op === "endLayer") layerScopes.push(`${command.op}:${command.key}`);
    if (command.op === "beginGroup" || command.op === "endGroup") groupScopes.push(`${command.op}:${command.key}`);
  }

  return {
    commandCount: buffer.commands.length,
    operationCounts,
    drawKeys,
    transformKeys,
    layerScopes,
    groupScopes,
  };
}

// ── Validator ─────────────────────────────────────────────────────────

/**
 * Validate a paint buffer against the current contract.
 * Returns a detailed result with issue list.
 * Preferred over raw validatePaintCommandBuffer for external consumers.
 */
export function validatePaintBuffer(
  buffer: PaintCommandBuffer,
): PaintValidateResult {
  return validatePaintCommandBuffer(buffer);
}

/**
 * Assert a paint buffer is structurally valid. Throws with diagnostic
 * details if validation fails — suitable for production gate checks.
 */
export function assertValidPaintBuffer(buffer: PaintCommandBuffer): void {
  const result = validatePaintCommandBuffer(buffer);
  if (!result.ok) {
    const detail = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => `[${i.code}] ${i.message}`)
      .join("; ");
    throw new Error(
      `Paint buffer validation failed: ${detail || "unknown error"}`,
    );
  }
}

// ── Diagnostics helpers ───────────────────────────────────────────────

/**
 * Check whether a paint buffer contains unsupported commands.
 * Production should never silently ignore these.
 */
export function countUnsupportedCommands(buffer: PaintCommandBuffer): number {
  let count = 0;
  for (const cmd of buffer.commands) {
    if (cmd.op === "unsupported") count += 1;
  }
  return count;
}

/**
 * Collect all diagnostics from a buffer including unsupported warnings.
 */
export function collectPaintDiagnostics(
  buffer: PaintCommandBuffer,
): Array<{
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
}> {
  const diags = [...buffer.diagnostics];
  for (const cmd of buffer.commands) {
    if (cmd.op === "unsupported") {
      diags.push({
        severity: "error",
        code: "unsupported_paint_op",
        message: `Unsupported node type "${cmd.nodeType}": ${cmd.message}`,
      });
    }
  }
  return diags;
}
