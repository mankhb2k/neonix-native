/**
 * Lỗi asset dùng chung 2 lớp validation — cùng envelope, khác `layer`.
 *
 * - authoring: JSON graph (parse / references) — id tồn tại, type, trim
 * - storage: kho bytes (motion-storage.validateAssets) — missing, hash, size, deleted
 *
 * Không gộp storage vào parseMotionProjectV1: protocol offline, không gọi R2.
 */
export type AssetValidationLayer = "authoring" | "storage";

export type AssetValidationCode =
  | "unknown_asset"
  | "asset_type_mismatch"
  | "video_trim_invalid"
  | "missing"
  | "integrity_mismatch"
  | "size_mismatch"
  | "deleted";

export type AssetValidationIssue = {
  layer: AssetValidationLayer;
  code: AssetValidationCode;
  message: string;
  path: string;
  assetId: string;
};

export function assetValidationIssue(
  issue: AssetValidationIssue,
): AssetValidationIssue {
  return issue;
}
