/**
 * Server-only hashing helpers (Node crypto).
 * Import via `@motionvideo/asset-registry/server`.
 */

import { createHash } from "node:crypto";
import {
  assertAssetHash,
  createAssetManifest,
  normalizeSha256,
  type AssetManifest,
  type AssetManifestEntry,
} from "./asset-manifest";

export function sha256Hex(bytes: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildAssetManifestEntry(input: {
  id: string;
  url: string;
  mimeType: string;
  bytes: Uint8Array | Buffer;
}): AssetManifestEntry {
  return {
    id: input.id,
    url: input.url,
    mimeType: input.mimeType,
    sha256: sha256Hex(input.bytes),
    byteLength: input.bytes.byteLength,
  };
}

export function buildAssetManifestFromBytes(
  entries: Array<{
    id: string;
    url: string;
    mimeType: string;
    bytes: Uint8Array | Buffer;
  }>,
): AssetManifest {
  return createAssetManifest(entries.map(buildAssetManifestEntry));
}

export {
  assertAssetHash,
  createAssetManifest,
  normalizeSha256,
  type AssetManifest,
  type AssetManifestEntry,
};
