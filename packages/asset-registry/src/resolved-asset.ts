/**
 * ResolvedAsset — shared media descriptor for preview + export preflight.
 */

import type { AssetManifestEntry } from "./asset-manifest";
import { normalizeSha256 } from "./asset-manifest";

export type ResolvedAsset = {
  id: string;
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
  /** Media duration in seconds when known. */
  durationSeconds?: number;
  /** Content integrity hash (sha256 hex, no prefix). */
  integrity?: string;
  byteLength?: number;
  /** Font family name when mime is a font. */
  fontFamily?: string;
};

export function resolvedAssetFromManifestEntry(
  entry: AssetManifestEntry,
  extras?: Partial<
    Pick<
      ResolvedAsset,
      "width" | "height" | "durationSeconds" | "fontFamily"
    >
  >,
): ResolvedAsset {
  return {
    id: entry.id,
    uri: entry.url,
    mimeType: entry.mimeType,
    integrity: normalizeSha256(entry.sha256),
    ...(entry.byteLength !== undefined ? { byteLength: entry.byteLength } : {}),
    ...extras,
  };
}

export function isFontMime(mimeType: string): boolean {
  return (
    mimeType.startsWith("font/") ||
    mimeType === "application/font-woff" ||
    mimeType === "application/font-woff2" ||
    mimeType === "application/x-font-ttf" ||
    mimeType === "application/x-font-otf"
  );
}

export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function isAudioMime(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
