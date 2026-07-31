/**
 * Injectable deps for deterministic commands (tests / goldens).
 */

export type CommandContext = {
  createId: (prefix: string) => string;
};

/** Default ID generator — same shape as legacy `uid()`. */
export function defaultCreateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const defaultCommandContext: CommandContext = {
  createId: defaultCreateId,
};
