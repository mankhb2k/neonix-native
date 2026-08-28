import type { PreviewAsset } from "./types";

export type PreviewAssetRevision = {
  assetId: string;
  resourceGeneration: number;
  contentRevision: number;
  decodedFrameRevision: number;
  width: number;
  height: number;
  format: "rgba8";
};

export type TextureUploadDecision =
  | { kind: "reuse" }
  | { kind: "upload-in-place" }
  | { kind: "recreate-and-upload" }
  | { kind: "remove" };

export function decideTextureUpdate(
  previous: PreviewAssetRevision | null,
  next: PreviewAssetRevision | null,
): TextureUploadDecision {
  if (!next) return { kind: "remove" };
  if (!previous) return { kind: "recreate-and-upload" };
  if (
    previous.assetId !== next.assetId
    || previous.resourceGeneration !== next.resourceGeneration
    || previous.contentRevision !== next.contentRevision
    || previous.width !== next.width
    || previous.height !== next.height
    || previous.format !== next.format
  ) return { kind: "recreate-and-upload" };
  if (previous.decodedFrameRevision !== next.decodedFrameRevision) {
    return { kind: "upload-in-place" };
  }
  return { kind: "reuse" };
}

export function previewAssetRevision(
  assetId: string,
  asset: PreviewAsset,
): PreviewAssetRevision {
  return {
    assetId,
    resourceGeneration: asset.resourceGeneration ?? 0,
    contentRevision: asset.contentRevision ?? 0,
    decodedFrameRevision: asset.decodedFrameRevision ?? (asset.kind === "video" ? asset.frameVersion ?? 0 : 0),
    width: asset.width,
    height: asset.height,
    format: "rgba8",
  };
}
