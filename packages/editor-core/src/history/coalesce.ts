import type { HistoryEntry, HistoryState } from "./history-types";
import { pushHistory } from "./history-manager";

export type CoalesceOptions = {
  /** When set and matches the last past entry's coalesceKey, replace that entry. */
  coalesceKey?: string;
};

/**
 * Push a history entry, or replace the last past entry when coalesce keys match.
 * Used so numeric scrub commits collapse to a single undo step.
 */
export function replaceOrPushHistory(
  state: HistoryState,
  entry: HistoryEntry,
  options: CoalesceOptions = {},
): HistoryState {
  const key = options.coalesceKey ?? entry.coalesceKey;
  if (key && state.past.length > 0) {
    const last = state.past[state.past.length - 1]!;
    if (last.coalesceKey === key) {
      const nextPast = state.past.slice(0, -1);
      nextPast.push({
        ...entry,
        coalesceKey: key,
        // Keep original before so undo restores pre-scrub state
        before: last.before,
      });
      return {
        ...state,
        past: nextPast,
        future: [],
      };
    }
  }
  return pushHistory(state, {
    ...entry,
    coalesceKey: key,
  });
}
