/**
 * AssetManifest — hashed asset descriptors for browser + server consumers.
 */

export type AssetManifestEntry = {
  id: string;
  url: string;
  sha256: string;
  mimeType: string;
  byteLength?: number;
};

export type AssetManifest = {
  format: "moticlip-asset-manifest";
  formatVersion: 1;
  entries: AssetManifestEntry[];
};

export function createAssetManifest(
  entries: AssetManifestEntry[],
): AssetManifest {
  return {
    format: "moticlip-asset-manifest",
    formatVersion: 1,
    entries: entries.map((entry) => ({
      id: entry.id,
      url: entry.url,
      sha256: normalizeSha256(entry.sha256),
      mimeType: entry.mimeType,
      ...(entry.byteLength !== undefined
        ? { byteLength: entry.byteLength }
        : {}),
    })),
  };
}

export function normalizeSha256(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("sha256:") ? trimmed.slice("sha256:".length) : trimmed;
}

export function findAssetEntry(
  manifest: AssetManifest,
  id: string,
): AssetManifestEntry | undefined {
  return manifest.entries.find((entry) => entry.id === id);
}

/**
 * Fail closed when expected hash does not match the entry (or entry is missing).
 */
export function assertAssetHash(
  manifest: AssetManifest,
  id: string,
  expectedSha256: string,
): AssetManifestEntry {
  const entry = findAssetEntry(manifest, id);
  if (!entry) {
    throw new Error(`AssetManifest missing entry: ${id}`);
  }
  const expected = normalizeSha256(expectedSha256);
  const actual = normalizeSha256(entry.sha256);
  if (expected !== actual) {
    throw new Error(
      `Asset hash mismatch for ${id}: expected ${expected}, got ${actual}`,
    );
  }
  return entry;
}

/** Browser-safe helpers (no node:crypto). */
export const browserAssetRegistry = {
  createAssetManifest,
  normalizeSha256,
  findAssetEntry,
  assertAssetHash,
};
