/**
 * Context menu for timeline empty runway / clip selection.
 */

import {
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../ui";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  selection: EditorSelection;
  disabled?: boolean;
  canPaste?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  getPlayheadTime: () => number;
};

export function TimelineContextMenu({
  children,
  className,
  selection,
  disabled,
  canPaste = false,
  onCopy,
  onCut,
  onPaste,
  onExecute,
  getPlayheadTime,
}: Props) {
  const hasSelection = selectedClipIdsFrom(selection).length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className} disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="timeline-context-menu">
        <ContextMenuItem
          disabled={!hasSelection || disabled}
          onSelect={() => onCopy?.()}
        >
          Copy
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasSelection || disabled}
          onSelect={() => onCut?.()}
        >
          Cut
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canPaste || disabled}
          onSelect={() => onPaste?.()}
        >
          Paste
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasSelection || disabled}
          onSelect={() =>
            onExecute({ type: "delete-selected-clips" }, "Delete clips")
          }
        >
          Delete
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasSelection || disabled}
          onSelect={() =>
            onExecute(
              { type: "duplicate-selected-clips" },
              "Duplicate clips",
            )
          }
        >
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasSelection || disabled}
          onSelect={() =>
            onExecute(
              { type: "split-selected-clips", time: getPlayheadTime() },
              "Split clips",
            )
          }
        >
          Split
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
