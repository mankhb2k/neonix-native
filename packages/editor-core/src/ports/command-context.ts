/**
 * Injectable deps for deterministic commands (tests / goldens).
 */

export type CommandContext = {
  createId: (prefix: string) => string;
};

/**
 * Process-global monotonic counter backing `defaultCreateId`.
 *
 * Policy: the default path is deterministic *within* one process run, but is
 * NOT order-independent — ids depend on how many were already minted this
 * process, so test/golden/fixture files must never rely on the default
 * generator. Anything needing reproducible ids across runs MUST inject a
 * seeded `createId` via `CommandContext` (see `deterministic-commands.test.ts`
 * and web `vite-phase0.ts` `withDeterministicIds`).
 */
let idCounter = 0;

/**
 * Default ID generator — deterministic per-process (no `Math.random`).
 * For reproducible goldens/fixtures, inject a seeded `createId` instead of
 * relying on this global counter.
 */
export function defaultCreateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export const defaultCommandContext: CommandContext = {
  createId: defaultCreateId,
};
