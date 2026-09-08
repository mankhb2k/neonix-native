import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { EditorCommand, EditorDiagnostic } from "../document/commands";
import { applyEditorCommand } from "../document/commands";

/** A committed authoring transaction and its inverse transaction. */
export type EditorHistoryEntry = {
  id: string;
  label: string;
  timestamp: number;
  undo: readonly EditorCommand[];
  redo: readonly EditorCommand[];
  selectionBefore?: readonly string[];
  selectionAfter?: readonly string[];
};

export type EditorCommandBatchResult =
  | {
      ok: true;
      document: MotionProtocolV2;
      inverse: readonly EditorCommand[];
      diagnostics: readonly EditorDiagnostic[];
    }
  | {
      ok: false;
      diagnostics: readonly EditorDiagnostic[];
    };

export type EditorHistoryEntryInput = {
  undo: readonly EditorCommand[];
  redo: readonly EditorCommand[];
  selectionBefore?: readonly string[];
  selectionAfter?: readonly string[];
  timestamp?: number;
  id?: string;
};

/** Maximum number of history entries retained by one editor instance. */
export const MAX_HISTORY_ENTRIES = 50;

/** Soft memory budget for one undo or redo stack. */
export const MAX_HISTORY_BYTES = 8 * 1024 * 1024;

const OBJECT_OVERHEAD_BYTES = 16;
const PROPERTY_OVERHEAD_BYTES = 8;
let historySequence = 0;

function commandLabel(commands: readonly EditorCommand[]): string {
  const type = commands[0]?.type;
  switch (type) {
    case "patch-layer":
    case "patch-layers":
      return "Transform layers";
    case "add-layer":
      return "Add layer";
    case "remove-layer":
      return "Remove layer";
    default:
      return type ? type.replaceAll("-", " ") : "Edit document";
  }
}

/** Create the package-owned history entry used by undo and redo. */
export function createEditorHistoryEntry(input: EditorHistoryEntryInput): EditorHistoryEntry {
  const timestamp = input.timestamp ?? Date.now();
  const id = input.id ?? `history-${timestamp}-${historySequence++}`;
  return {
    id,
    label: commandLabel(input.redo),
    timestamp,
    undo: input.undo,
    redo: input.redo,
    selectionBefore: input.selectionBefore,
    selectionAfter: input.selectionAfter,
  };
}

/** Apply a transaction atomically; no partial document is returned on failure. */
export function applyEditorCommands(
  document: MotionProtocolV2,
  commands: readonly EditorCommand[],
): EditorCommandBatchResult {
  let next = document;
  const inverse: EditorCommand[] = [];
  for (const command of commands) {
    const result = applyEditorCommand(next, command);
    if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
    next = result.document;
    inverse.unshift(result.inverse);
  }
  return { ok: true, document: next, inverse, diagnostics: [] };
}

export function selectionStillExists(
  document: MotionProtocolV2,
  id: string,
): boolean {
  if (document.layers.some((layer) => layer.id === id)) return true;
  return document.audio.tracks.some((track) =>
    track.clips.some((clip) => `audio.${clip.id}` === id),
  );
}

/** Delete selected layer subtrees in child-first order so group removal is valid. */
export function removeSelectedLayerCommands(
  document: MotionProtocolV2,
  selectedIds: readonly string[],
): EditorCommand[] {
  const selected = new Set(
    selectedIds.filter((id) => document.layers.some((layer) => layer.id === id)),
  );
  if (selected.size === 0) return [];

  const byParent = new Map<string | null, string[]>();
  for (const layer of document.layers) {
    const children = byParent.get(layer.parentLayerId) ?? [];
    children.push(layer.id);
    byParent.set(layer.parentLayerId, children);
  }
  const roots = [...selected].filter((id) => {
    let parentId = document.layers.find((layer) => layer.id === id)?.parentLayerId;
    while (parentId != null) {
      if (selected.has(parentId)) return false;
      parentId = document.layers.find((layer) => layer.id === parentId)?.parentLayerId;
    }
    return true;
  });
  const orderedIds: string[] = [];
  const visit = (id: string) => {
    for (const childId of byParent.get(id) ?? []) visit(childId);
    orderedIds.push(id);
  };
  for (const id of roots) visit(id);

  return orderedIds.map((layerId) => ({ type: "remove-layer", layerId }));
}

/**
 * Estimate the retained memory of a history value without serializing it.
 * This is a policy estimate, not a heap-profiler measurement.
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
            (total, item) => total + estimate(item),
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
