export type SystemFallbackMediaKind = "image" | "video" | "audio";

export const SYSTEM_ASSET_FALLBACK_IDS = {
  image: "system:image-placeholder",
  svg: "system:svg-placeholder",
  video: "system:video-placeholder",
  audio: "system:audio-silence",
} as const;

export function systemAssetFallbackId(
  kind: SystemFallbackMediaKind,
  mimeType?: string,
): string {
  if (kind === "video") return SYSTEM_ASSET_FALLBACK_IDS.video;
  if (kind === "audio") return SYSTEM_ASSET_FALLBACK_IDS.audio;
  return mimeType === "image/svg+xml"
    ? SYSTEM_ASSET_FALLBACK_IDS.svg
    : SYSTEM_ASSET_FALLBACK_IDS.image;
}

export function systemAssetFallbackUrl(
  kind: SystemFallbackMediaKind,
  mimeType?: string,
): string {
  return `/api/system-assets/${encodeURIComponent(systemAssetFallbackId(kind, mimeType))}`;
}
