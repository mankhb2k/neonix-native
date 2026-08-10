/**
 * Content hash — deterministic SHA-256 of the compiled runtime JSON.
 *
 * Guarantees: same MotionRuntimeProject → same hash
 * regardless of serialization order, whitespace, or platform.
 *
 * Phase 11 note: equivalent functions exist in
 * @motionvideo/motion-protocol (canonical-hash.ts). This module stays
 * self-contained to avoid adding a dependency to render-contracts.
 */

import { createHash } from "node:crypto";

/**
 * Deep-sort object keys recursively for canonical JSON serialization.
 */
function deepSortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepSortKeys);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = deepSortKeys(obj[key]);
  }
  return sorted;
}

/**
 * Compute a deterministic SHA-256 of any JSON-serializable object.
 */
export function computeContentHash(runtimeJson: object): string {
  const sorted = deepSortKeys(runtimeJson);
  return createHash("sha256").update(JSON.stringify(sorted), "utf8").digest("hex");
}

/**
 * Compute an incremental content hash from a stream of string chunks.
 */
export function createContentHasher(): {
  update(chunk: string): void;
  digest(): string;
} {
  const hash = createHash("sha256");
  return {
    update(chunk: string) {
      hash.update(chunk, "utf8");
    },
    digest() {
      return hash.digest("hex");
    },
  };
}

/**
 * Short hash (first 16 hex chars) for display / comparison.
 */
export function shortHash(full: string): string {
  return full.slice(0, 16);
}

/**
 * Compare two full content hashes in constant-time-ish fashion.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
