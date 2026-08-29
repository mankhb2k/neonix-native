/**
 * Hash canonical — deterministic hashing for motion artifacts.
 *
 * Moved from @motionvideo/motion-protocol (V1) into export-renderer contracts so
 * motion-protocol stays schema-only ("atom"). Consolidates with
 * content-hash.ts, which owns the generic helpers (`computeContentHash`,
 * `shortHash`, `hashesMatch`, `deepSortKeys`).
 *
 * Same semantic project / runtime IR → same hash. Excludes timestamps /
 * provenance / extensions from the render hash.
 */
import { sha256Hex } from "./sha256";
import { shortHash } from "./content-hash";

// ── Versioning ──────────────────────────────────────────────────────────

/**
 * Render manifest format version. Bump when the manifest shape changes
 * in a way that would invalidate cached exports.
 */
export const RENDER_MANIFEST_VERSION = 1;

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

// ── Project Hash ───────────────────────────────────────────────────────

/**
 * Strip non-deterministic fields before hashing so the same semantic
 * project always produces the same hash regardless of timestamps,
 * provenance metadata, or extension data.
 */
function stripNonDeterministic(
  project: Record<string, unknown>,
): Record<string, unknown> {
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
  return sha256Hex(canonical);
}

/**
 * Short project hash (first 16 chars) for display / cache keys.
 */
export function computeProjectHashShort(
  project: Record<string, unknown>,
): string {
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
  const hashInputs = { ...ir };
  delete hashInputs.runtimeHash;
  return sha256Hex(canonicalJson(hashInputs)).slice(0, 32);
}

// ── Capability Fingerprint ─────────────────────────────────────────────

/**
 * Build a deterministic fingerprint from a capability manifest version string.
 */
export function buildCapabilityFingerprint(manifestVersion: string): string {
  return sha256Hex(`motion-capabilities:${manifestVersion}`).slice(0, 16);
}
