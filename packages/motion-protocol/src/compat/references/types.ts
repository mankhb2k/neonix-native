export interface ReferenceIssue {
  path: string;
  message: string;
}

export class MotionV2ReferenceError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV2ReferenceError";
  }
}
