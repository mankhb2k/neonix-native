import type { HtmlCompilerSourceLocation } from "../source";

export class CompileError extends Error {
  constructor(readonly code: string, message: string, readonly source?: HtmlCompilerSourceLocation) {
    super(message);
  }
}

export type CompileIssue = Readonly<{ code: string; message: string }>;

/** Carries every independent validation failure found in one pass, instead of stopping at the first one. */
export class CompileIssues extends Error {
  constructor(readonly issues: readonly CompileIssue[]) {
    super(issues.map((issue) => issue.message).join("; "));
  }
}

export const fail = (code: string, message: string): never => { throw new CompileError(code, message); };

export function sourceLocation(text: string, offset: number, kind: HtmlCompilerSourceLocation["kind"]): HtmlCompilerSourceLocation {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { kind, offset: safeOffset, line, column: safeOffset - lastNewline };
}

