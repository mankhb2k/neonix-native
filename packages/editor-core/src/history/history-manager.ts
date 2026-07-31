import type {
  HistoryEntry,
  HistoryState,
} from "./history-types";

export const DEFAULT_HISTORY_BUDGET = 50;

export function createHistoryState(
  maxBudget = DEFAULT_HISTORY_BUDGET,
): HistoryState {
  return {
    past: [],
    future: [],
    maxBudget,
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

export function pushHistory(
  state: HistoryState,
  entry: HistoryEntry,
): HistoryState {
  const nextPast = [...state.past, entry];
  if (nextPast.length > state.maxBudget) {
    nextPast.splice(0, nextPast.length - state.maxBudget);
  }
  return {
    ...state,
    past: nextPast,
    future: [],
  };
}

export function undoHistory(
  state: HistoryState,
): { state: HistoryState; entry: HistoryEntry | null } {
  if (!canUndo(state)) return { state, entry: null };
  const nextPast = [...state.past];
  const entry = nextPast.pop()!;
  return {
    state: {
      ...state,
      past: nextPast,
      future: [entry, ...state.future],
    },
    entry,
  };
}

export function redoHistory(
  state: HistoryState,
): { state: HistoryState; entry: HistoryEntry | null } {
  if (!canRedo(state)) return { state, entry: null };
  const nextFuture = [...state.future];
  const entry = nextFuture.shift()!;
  return {
    state: {
      ...state,
      past: [...state.past, entry],
      future: nextFuture,
    },
    entry,
  };
}

export function clearHistory(
  state: HistoryState = createHistoryState(),
): HistoryState {
  return {
    ...state,
    past: [],
    future: [],
  };
}
