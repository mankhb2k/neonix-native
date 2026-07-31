import type { EditorSelection } from "@/lib/editor/model/editor-selection";
import type { TimelineDocument } from "@/lib/editor/timeline/document";

export type HistoryEntry = {
  id: string;
  timestamp: number;
  label: string;
  before: TimelineDocument;
  after: TimelineDocument;
  beforeSelection?: EditorSelection;
  afterSelection?: EditorSelection;
};

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  maxBudget: number;
};
