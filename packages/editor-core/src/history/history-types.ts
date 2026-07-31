import type { EditorSelection } from "../selection/editor-selection";
import type { TimelineDocument } from "../document/document";

export type HistoryEntry = {
  id: string;
  timestamp: number;
  label: string;
  before: TimelineDocument;
  after: TimelineDocument;
  beforeSelection?: EditorSelection;
  afterSelection?: EditorSelection;
  /** When set, replaceOrPushHistory can coalesce scrub commits. */
  coalesceKey?: string;
};

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  maxBudget: number;
};
