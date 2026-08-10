/**
 * Canonical hash — single source of truth for deterministic hashing.
 *
 * Phase 11: Consolidates hashing from motion-compiler, render-contracts,
 * editor-core, and motion-protocol into one module.
 *
 * Guarantees:
 * - Same semantic v3 project → same projectHash
 * - Same runtime IR → same runtimeHash
 * - Timestamps, provenance, extensions, and editor state are EXCLUDED
 *   from the project hash so they don't break reproducibility.
 */
import { createHash } from "node:crypto";

// ── Versioning ──────────────────────────────────────────────────────────

/**
 * Render manifest format version. Bump when the manifest shape changes
 * in a way that would invalidate cached exports.
 */
export const RENDER_MANIFEST_VERSION = 1;

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

// ── Canonical JSON ─────────────────────────────────────────────────────

/**
 * Recursive key-sorted canonical JSON for deterministic hashing.
 *
 * Stable across Node versions: sorts object keys alphabetically,
 * preserves array order (arrays are semantically ordered in JSON).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Deep-sort keys for JSON.stringify-based canonical output.
 * Returns a new object (not a string) suitable for JSON.stringify.
 */
export function deepSortKeys<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepSortKeys) as unknown as T;
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = deepSortKeys(obj[key]);
  }
  return sorted as unknown as T;
}

// ── Project Hash ───────────────────────────────────────────────────────

/** Fields to strip from canonical hash that are never semantically meaningful. */
const HASH_STRIP_PATHS = new Set([
  "metadata.createdAt",
  "metadata.updatedAt",
  "metadata.generator",
  "provenance",
  "extensions",
]);

/**
 * Strip non-deterministic fields before hashing so the same semantic
 * project always produces the same hash regardless of timestamps,
 * provenance metadata, or extension data.
 */
function stripNonDeterministic(project: Record<string, unknown>): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
  if (cloned.provenance) delete cloned.provenance;
  if (cloned.extensions) delete cloned.extensions;
  if (cloned.metadata && typeof cloned.metadata === "object") {
    const meta = cloned.metadata as Record<string, unknown>;
    delete meta.createdAt;
    delete meta.updatedAt;
    delete meta.generator;
  }
  return cloned;
}

/**
 * Compute a deterministic SHA-256 project hash.
 *
 * Strips: metadata.createdAt, metadata.updatedAt, metadata.generator,
 * provenance, extensions.
 *
 * Returns full 64-character hex digest.
 */
export function computeProjectHash(project: Record<string, unknown>): string {
  const stripped = stripNonDeterministic(project);
  const canonical = canonicalJson(stripped);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Short project hash (first 16 chars) for display / cache keys.
 */
export function computeProjectHashShort(project: Record<string, unknown>): string {
  return shortHash(computeProjectHash(project));
}

// ── Runtime Hash ───────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash of compiled runtime IR.
 *
 * Excludes the `runtimeHash` field itself so the hash is stable.
 * Returns first 32 hex chars (128-bit) for compact storage.
 */
export function computeRuntimeHash(ir: Record<string, unknown>): string {
  const { runtimeHash: _omit, ...hashInputs } = ir;
  return createHash("sha256")
    .update(canonicalJson(hashInputs), "utf8")
    .digest("hex")
    .slice(0, 32);
}

// ── Content Hash (for render-contracts compatibility) ──────────────────

/**
 * Compute a deterministic SHA-256 of any JSON-serializable object.
 * Uses deepSortKeys → JSON.stringify for cross-platform stability.
 */
export function computeContentHash(value: object): string {
  const sorted = deepSortKeys(value);
  return createHash("sha256").update(JSON.stringify(sorted), "utf8").digest("hex");
}

// ── Capability Fingerprint ─────────────────────────────────────────────

/**
 * Build a deterministic fingerprint from a capability manifest version string.
 */
export function buildCapabilityFingerprint(manifestVersion: string): string {
  return createHash("sha256")
    .update(`motion-capabilities:${manifestVersion}`)
    .digest("hex")
    .slice(0, 16);
}
