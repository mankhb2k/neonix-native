/**
 * Registry of timeline context-menu actions (selection → command / clipboard).
 */

import {
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineCommand,
} from "@motionvideo/editor-core";

export type TimelineContextActionId =
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "duplicate"
  | "split";

export type TimelineContextAction = {
  id: TimelineContextActionId;
  label: string;
  disabled: boolean;
  run: () => void;
};

export type TimelineContextActionContext = {
  selection: EditorSelection;
  disabled?: boolean;
  canPaste?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  getPlayheadTime: () => number;
};

export function buildTimelineContextActions(
  ctx: TimelineContextActionContext,
): TimelineContextAction[] {
  const hasSelection = selectedClipIdsFrom(ctx.selection).length > 0;
  const off = Boolean(ctx.disabled);
  return [
    {
      id: "copy",
      label: "Copy",
      disabled: !hasSelection || off,
      run: () => ctx.onCopy?.(),
    },
    {
      id: "cut",
      label: "Cut",
      disabled: !hasSelection || off,
      run: () => ctx.onCut?.(),
    },
    {
      id: "paste",
      label: "Paste",
      disabled: !ctx.canPaste || off,
      run: () => ctx.onPaste?.(),
    },
    {
      id: "delete",
      label: "Delete",
      disabled: !hasSelection || off,
      run: () =>
        ctx.onExecute({ type: "delete-selected-clips" }, "Delete clips"),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      disabled: !hasSelection || off,
      run: () =>
        ctx.onExecute(
          { type: "duplicate-selected-clips" },
          "Duplicate clips",
        ),
    },
    {
      id: "split",
      label: "Split",
      disabled: !hasSelection || off,
      run: () =>
        ctx.onExecute(
          { type: "split-selected-clips", time: ctx.getPlayheadTime() },
          "Split clips",
        ),
    },
  ];
}
