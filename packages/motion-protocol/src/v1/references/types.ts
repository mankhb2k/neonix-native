/**
 * V1 reference validation types — canonical source of truth.
 *
 * Asset bytes liveness dùng cùng envelope: xem `AssetValidationIssue`
 * (`layer: "authoring" | "storage"`). Graph issues khác chỉ cần path + message.
 */
import type { AssetValidationIssue } from "../asset-validation";

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
