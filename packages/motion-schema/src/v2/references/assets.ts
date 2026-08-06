import type { z } from "zod";
import { AssetV2Schema } from "../assets";
import type { MotionNode } from "../nodes";
import type { ReferenceIssue } from "./types";

export function validateNodeAssets(
  nodes: Array<MotionNode>,
  assets: Array<z.infer<typeof AssetV2Schema>>,
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const node of nodes) {
    if (node.type === "image" || node.type === "svg" || node.type === "video") {
      const assetId = node.payload.assetId;
      const asset = assetById.get(assetId);
      const path = `${prefix}.${node.id}.payload.assetId`;
      if (!asset) issues.push({ path, message: `Unknown asset: ${assetId}` });
      else {
        const expected = node.type;
        if (asset.assetType !== expected) {
          issues.push({ path, message: `Asset ${assetId} has type ${asset.assetType}, expected ${expected}` });
        } else if (node.type === "video" && asset.assetType === "video") {
          const trimStart = node.payload.trimStart ?? 0;
          const trimEnd = node.payload.trimEnd ?? asset.duration;
          if (trimStart >= trimEnd || trimEnd > asset.duration) {
            issues.push({
              path: `${prefix}.${node.id}.payload`,
              message: `Video trim must satisfy 0 <= trimStart < trimEnd <= ${asset.duration}`,
            });
          }
        }
      }
    }
    const fontAssetId = node.type === "text" ? node.payload.fontAssetId : undefined;
    if (typeof fontAssetId === "string") {
      const asset = assetById.get(fontAssetId);
      const path = `${prefix}.${node.id}.payload.fontAssetId`;
      if (!asset) issues.push({ path, message: `Unknown asset: ${fontAssetId}` });
      else if (asset.assetType !== "font") issues.push({ path, message: `Asset ${fontAssetId} has type ${asset.assetType}, expected font` });
    }
  }
  return issues;
}
