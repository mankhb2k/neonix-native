/**
 * Kiểu lỗi reference. Asset byte dùng AssetValidationIssue (layer authoring | storage).
 */
import type { AssetValidationIssue } from "../assets/validation";

export type ReferenceIssue = {
  path: string;
  message: string;
  layer?: AssetValidationIssue["layer"];
  code?: AssetValidationIssue["code"];
  assetId?: string;
};

export class MotionV1ReferenceError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV1ReferenceError";
  }
}
