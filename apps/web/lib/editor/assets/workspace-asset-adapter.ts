import type { Asset as WorkspaceAsset } from "@/lib/api/assets";
import type { V2Asset } from "@motionvideo/motion-protocol/v2";

export function workspaceAssetToProtocolAsset(
  asset: WorkspaceAsset,
): V2Asset | null {
  if (!asset.download_url) return null;

  const common = {
    id: `asset-${asset.id}`,
    uri: asset.download_url,
    mimeType: asset.mime_type,
  };

  if (asset.mime_type.startsWith("image/")) {
    return {
      ...common,
      kind: "image",
      ...(asset.source_width ? { width: asset.source_width } : {}),
      ...(asset.source_height ? { height: asset.source_height } : {}),
    };
  }

  if (asset.mime_type.startsWith("video/")) {
    return {
      ...common,
      kind: "video",
      ...(asset.source_width ? { width: asset.source_width } : {}),
      ...(asset.source_height ? { height: asset.source_height } : {}),
      ...(asset.source_duration_ms != null
        ? { duration: asset.source_duration_ms }
        : {}),
    };
  }

  if (asset.mime_type.startsWith("audio/")) {
    return {
      ...common,
      kind: "audio",
      ...(asset.source_duration_ms != null
        ? { duration: asset.source_duration_ms }
        : {}),
    };
  }

  return null;
}
