/**
 * V3 reference validation types.
 */
export type { ReferenceIssue } from "../../v2/references/types";

export class MotionV3ReferenceError extends Error {
  constructor(
    public readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV3ReferenceError";
  }
}
