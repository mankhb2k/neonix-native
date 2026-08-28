import type { EditorHistoryEntry } from "./editor-store";

/** Maximum number of history entries retained by one editor instance. */
export const MAX_HISTORY_ENTRIES = 50;

/** Soft memory budget for one undo or redo stack. */
export const MAX_HISTORY_BYTES = 8 * 1024 * 1024;

const OBJECT_OVERHEAD_BYTES = 16;
const PROPERTY_OVERHEAD_BYTES = 8;

/**
 * Estimate the retained memory of a history value without serializing it.
 *
 * History commands are plain data today, but this deliberately handles typed
 * arrays and cycles so a future command payload cannot make the policy throw.
 * The value is an estimate, not a heap-profiler measurement.
 */
export function estimateHistoryBytes(value: unknown): number {
  const seen = new Set<object>();

  const estimate = (input: unknown): number => {
    if (input == null) return 8;
    switch (typeof input) {
      case "boolean":
        return 4;
      case "number":
        return 8;
      case "bigint":
        return 8;
      case "string":
        return input.length * 2;
      case "symbol":
      case "function":
        return 0;
      case "object": {
        if (seen.has(input)) return 0;
        seen.add(input);
        if (ArrayBuffer.isView(input)) return input.byteLength + OBJECT_OVERHEAD_BYTES;
        if (input instanceof ArrayBuffer) return input.byteLength + OBJECT_OVERHEAD_BYTES;
        if (Array.isArray(input)) {
          const items = input as unknown[];
          return OBJECT_OVERHEAD_BYTES + items.reduce<number>(
            (total: number, item: unknown) => total + estimate(item),
            0,
          );
        }
        const record = input as Record<string, unknown>;
        return OBJECT_OVERHEAD_BYTES + Object.entries(record).reduce(
          (total, [key, item]) => total + key.length * 2 + PROPERTY_OVERHEAD_BYTES + estimate(item),
          0,
        );
      }
      default:
        return 0;
    }
  };

  return estimate(value);
}

export function estimateHistoryEntryBytes(entry: EditorHistoryEntry): number {
  return estimateHistoryBytes(entry);
}

/** Keep the newest entries while enforcing both count and byte budgets. */
export function trimHistory(
  entries: readonly EditorHistoryEntry[],
  options: {
    maxEntries?: number;
    maxBytes?: number;
  } = {},
): readonly EditorHistoryEntry[] {
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? MAX_HISTORY_ENTRIES));
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? MAX_HISTORY_BYTES));
  const kept: EditorHistoryEntry[] = [];
  let bytes = 0;

  for (let index = entries.length - 1; index >= 0 && kept.length < maxEntries; index -= 1) {
    const entry = entries[index];
    const entryBytes = estimateHistoryEntryBytes(entry);
    // Always keep the newest entry, even if that single command exceeds the
    // budget; dropping the command just committed would make Undo surprising.
    if (kept.length > 0 && bytes + entryBytes > maxBytes) break;
    kept.push(entry);
    bytes += entryBytes;
  }

  return kept.reverse();
}

export function appendUndoEntry(
  entries: readonly EditorHistoryEntry[],
  entry: EditorHistoryEntry,
): readonly EditorHistoryEntry[] {
  return trimHistory([...entries, entry]);
}

export function appendRedoEntry(
  entries: readonly EditorHistoryEntry[],
  entry: EditorHistoryEntry,
): readonly EditorHistoryEntry[] {
  return trimHistory([...entries, entry]);
}

export function appendOrCoalesceUndoEntry(
  entries: readonly EditorHistoryEntry[],
  historyKey: string,
  lastHistoryKey: string | null,
  entry: EditorHistoryEntry,
): readonly EditorHistoryEntry[] {
  if (historyKey !== lastHistoryKey || entries.length === 0) {
    return appendUndoEntry(entries, entry);
  }
  const next = [...entries];
  next[next.length - 1] = {
    ...next[next.length - 1],
    redo: entry.redo,
  };
  return trimHistory(next);
}
