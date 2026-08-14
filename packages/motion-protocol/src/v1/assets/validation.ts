/**
 * Lỗi asset dùng chung hai lớp validation — cùng envelope, khác layer.
 *
 * authoring: đồ thị JSON (id, type, trim). storage: byte (R2 / disk).
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
