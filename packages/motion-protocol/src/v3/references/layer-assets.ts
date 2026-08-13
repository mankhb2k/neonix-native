/**
 * V3 node → asset reference validation (media + font).
 */
import type { LayerV3 } from "../layers";
import type { AssetV3 } from "../assets";
import type { ReferenceIssue } from "./types";

export function validateLayerAssetsV3(
  layers: LayerV3[],
  assets: AssetV3[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  for (const node of layers) {
    if (node.type === "image" || node.type === "svg" || node.type === "video") {
      const assetId = node.payload.assetId;
      const asset = byId.get(assetId);
      const path = `${prefix}.${node.id}.payload.assetId`;
      if (!asset) {
        issues.push({ path, message: `Unknown asset: ${assetId}` });
      } else if (asset.assetType !== node.type) {
        issues.push({
          path,
          message: `Asset ${assetId} has type ${asset.assetType}, expected ${node.type}`,
        });
      } else if (node.type === "video" && asset.assetType === "video") {
        const trimStart = node.payload.trimStart ?? 0;
        const trimEnd = node.payload.trimEnd ?? asset.duration;
        if (trimStart >= trimEnd || trimEnd > asset.duration) {
          issues.push({
            path,
            message: `Video trim must satisfy 0 <= trimStart < trimEnd <= ${asset.duration}`,
          });
        }
      }
    }
    const fontAssetId =
      node.type === "text" ? node.payload.fontAssetId : undefined;
    if (typeof fontAssetId === "string") {
      const asset = byId.get(fontAssetId);
      const path = `${prefix}.${node.id}.payload.fontAssetId`;
      if (!asset) {
        issues.push({ path, message: `Unknown asset: ${fontAssetId}` });
      } else if (asset.assetType !== "font") {
        issues.push({
          path,
          message: `Asset ${fontAssetId} has type ${asset.assetType}, expected font`,
        });
      }
    }
  }
  return issues;
}
