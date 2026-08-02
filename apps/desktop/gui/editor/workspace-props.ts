import type { ReactNode } from "react";
import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import type { DocumentAssetEntry } from "./assets/document-assets";

/**
 * Shared editor-view slice used by Sidebar, Timeline, Inspector, etc.
 * Layout shell stays slot-only; parents pass this (or subsets) into panels.
 */
export type EditorViewProps = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
  selection: EditorSelection;
  assets?: DocumentAssetEntry[];
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

/** Library / left dock: view props + media slot + optional initial tab. */
export type EditorSidebarProps = EditorViewProps & {
  media: ReactNode;
  /** Fixture / deep-link: open Layers or Media on mount. */
  initialTab?: string;
};

export const EMPTY_EDITOR_VIEW_PROPS: Pick<
  EditorViewProps,
  "lanes" | "clips" | "selection" | "assets"
> = {
  lanes: [],
  clips: [],
  selection: { kind: "none" },
  assets: [],
};
