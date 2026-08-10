/**
 * V3 reference validation types — canonical source of truth.
 *
 * Phase 2: ReferenceIssue is now defined here (was re-exported from legacy).
 */
export interface ReferenceIssue {
  path: string;
  message: string;
}

export class MotionV3ReferenceError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV3ReferenceError";
  }
}
