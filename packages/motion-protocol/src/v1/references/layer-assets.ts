/**
 * Lớp authoring: layer → asset trong JSON (không đụng R2).
 *
 * Lớp storage (missing / integrity / size) nằm ở motion-storage.validateAssets.
 */
import type { LayerV1 } from "../layers";
import type { AssetV1 } from "../assets";
import type { AssetValidationIssue } from "../assets/validation";
import { assetValidationIssue } from "../assets/validation";

export function validateLayerAssetsV1(
  layers: LayerV1[],
  assets: AssetV1[],
  prefix: string,
): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  for (const layer of layers) {
    if (layer.type === "audio") {
      const assetId = layer.payload.assetId;
      const asset = byId.get(assetId);
      const path = `${prefix}.${layer.id}.payload.assetId`;
      if (!asset) {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "unknown_asset",
            assetId,
            path,
            message: `Unknown asset: ${assetId}`,
          }),
        );
      } else if (asset.assetType !== "audio") {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "asset_type_mismatch",
            assetId,
            path,
            message: `Asset ${assetId} has type ${asset.assetType}, expected audio`,
          }),
        );
      }
      continue;
    }
    if (layer.type === "image" || layer.type === "svg" || layer.type === "video") {
      const assetId = layer.payload.assetId;
      const asset = byId.get(assetId);
      const path = `${prefix}.${layer.id}.payload.assetId`;
      if (!asset) {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "unknown_asset",
            assetId,
            path,
            message: `Unknown asset: ${assetId}`,
          }),
        );
      } else if (asset.assetType !== layer.type) {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "asset_type_mismatch",
            assetId,
            path,
            message: `Asset ${assetId} has type ${asset.assetType}, expected ${layer.type}`,
          }),
        );
      } else if (layer.type === "video" && asset.assetType === "video") {
        const trimStart = layer.payload.trimStart ?? 0;
        const trimEnd = layer.payload.trimEnd ?? asset.duration;
        if (trimStart >= trimEnd || trimEnd > asset.duration) {
          issues.push(
            assetValidationIssue({
              layer: "authoring",
              code: "video_trim_invalid",
              assetId,
              path,
              message: `Video trim must satisfy 0 <= trimStart < trimEnd <= ${asset.duration}`,
            }),
          );
        }
      }
    }
    const fontAssetId =
      layer.type === "text" ? layer.payload.fontAssetId : undefined;
    if (typeof fontAssetId === "string") {
      const asset = byId.get(fontAssetId);
      const path = `${prefix}.${layer.id}.payload.fontAssetId`;
      if (!asset) {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "unknown_asset",
            assetId: fontAssetId,
            path,
            message: `Unknown asset: ${fontAssetId}`,
          }),
        );
      } else if (asset.assetType !== "font") {
        issues.push(
          assetValidationIssue({
            layer: "authoring",
            code: "asset_type_mismatch",
            assetId: fontAssetId,
            path,
            message: `Asset ${fontAssetId} has type ${asset.assetType}, expected font`,
          }),
        );
      }
    }
  }
  return issues;
}
