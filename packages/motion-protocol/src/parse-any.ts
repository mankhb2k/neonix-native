/**
 * Unified parse API — routes unknown input to the v2 or v3 parser based on
 * `format` + `formatVersion`, surfacing structured errors instead of raw
 * Zod failures.
 */
import { ZodError } from "zod";
import { parseMotionProjectV2, type MotionProjectV2 } from "./v2";
import { parseMotionProjectV3, type MotionProjectV3 } from "./v3";
import { MotionV2ReferenceError } from "./v2/references/types";
import { MotionV3ReferenceError } from "./v3/references/types";

export type ParsedMotionProject =
  | { version: 2; project: MotionProjectV2 }
  | { version: 3; project: MotionProjectV3 };

export type MotionProjectParseErrorCode =
  | "invalid_input"
  | "unsupported_version"
  | "parse_failed";

export interface MotionProjectParseIssue {
  path?: string;
  message: string;
}

export class MotionProjectParseError extends Error {
  constructor(
    public readonly code: MotionProjectParseErrorCode,
    message: string,
    public readonly issues: MotionProjectParseIssue[] = [],
  ) {
    super(message);
    this.name = "MotionProjectParseError";
  }
}

function issuesFromError(error: unknown): MotionProjectParseIssue[] {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  if (
    error instanceof MotionV2ReferenceError ||
    error instanceof MotionV3ReferenceError
  ) {
    return error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
  }
  return [];
}

function wrapParseError(
  version: 2 | 3,
  error: unknown,
): MotionProjectParseError {
  const issues = issuesFromError(error);
  const summary =
    issues.length > 0 ? `: ${issues[0]!.path ?? ""} ${issues[0]!.message}` : "";
  return new MotionProjectParseError(
    "parse_failed",
    `Failed to parse motion project (v${version})${summary}`,
    issues,
  );
}

export function parseMotionProjectAny(input: unknown): ParsedMotionProject {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new MotionProjectParseError(
      "invalid_input",
      "Expected a motion project object",
    );
  }
  const record = input as Record<string, unknown>;
  if (record.format !== "motion-project") {
    throw new MotionProjectParseError(
      "invalid_input",
      `Unsupported format: ${String(record.format)}`,
    );
  }
  if (record.formatVersion === 2) {
    try {
      return { version: 2, project: parseMotionProjectV2(input) };
    } catch (error) {
      throw wrapParseError(2, error);
    }
  }
  if (record.formatVersion === 3) {
    try {
      return { version: 3, project: parseMotionProjectV3(input) };
    } catch (error) {
      throw wrapParseError(3, error);
    }
  }
  throw new MotionProjectParseError(
    "unsupported_version",
    `Unsupported formatVersion: ${String(record.formatVersion)}`,
  );
}
