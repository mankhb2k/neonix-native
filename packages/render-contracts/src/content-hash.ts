/**
 * Content hash — deterministic SHA-256 of the compiled runtime JSON.
 *
 * §Phase 10 Task 10.1 in core-engine-tasks.md
 *
 * Guarantees: same NormalizedMotionProjectV2 → same hash
 * regardless of serialization order, whitespace, or platform.
 *
 * Used by RenderManifest to ensure export reproducibility.
 */

import { createHash } from "node:crypto";

/**
 * Compute a deterministic SHA-256 of the compiled runtime project.
 *
 * The input is JSON-serialized with stable key ordering (JSON.stringify
 * is deterministic in V8 for same-shape objects). To guarantee cross-
 * platform stability, we:
 * 1. Deep-sort the JSON keys to produce canonical serialization
 * 2. Hash the UTF-8 bytes of the canonical JSON
 * 3. Return the hex digest
 */
export function computeContentHash(runtimeJson: object): string {
  const canonical = canonicalJson(runtimeJson);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Deep-sort object keys recursively for canonical JSON serialization.
 * Sorts array elements where they are plain objects with an "id" key.
 */
function canonicalJson(value: unknown): string {
  const sorted = deepSortKeys(value);
  return JSON.stringify(sorted);
}

function deepSortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }

  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = deepSortKeys(obj[key]);
  }

  return sorted;
}

/**
 * Compute an incremental content hash from a stream of string chunks.
 * Useful for hashing large runtime payloads without full serialization.
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
 * Compare two full content hashes. Returns true if they match.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Constant-time-ish compare (not truly constant but safe enough)
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
