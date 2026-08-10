/**
 * Paint buffer contract — versioning and validation entrypoint.
 *
 * This module is the public API for contract version checks and
 * paint buffer validation used by parity harness, export, and
 * worker protocols.
 *
 * §4 in core-engine-tasks.md, Task 4.4
 */

import { PAINT_COMMAND_VERSION } from "./paint-command-buffer";
import { validatePaintCommandBuffer } from "./validate-paint-command-buffer";
import type { PaintCommandBuffer } from "./paint-command-buffer";
import type { PaintValidateResult } from "./paint-display-list";

// ── Public contract version ───────────────────────────────────────────

/**
 * The paint contract version used by the parity harness and export.
 * Must match the consumer side exactly. Bump when paint op semantics or
 * required fields change.
 */
export const paintContractVersion = PAINT_COMMAND_VERSION;

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
): Array<{ severity: "info" | "warning" | "error"; code: string; message: string }> {
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
