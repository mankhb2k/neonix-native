import type { HtmlCompilerSourceLocation } from "../source";

export class CompileError extends Error {
  constructor(readonly code: string, message: string, readonly source?: HtmlCompilerSourceLocation) {
    super(message);
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

