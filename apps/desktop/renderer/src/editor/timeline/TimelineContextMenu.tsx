/**
 * Context menu for timeline empty runway / clip selection.
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../ui";
import { buildTimelineContextActions } from "./timeline-context-actions";
import type { EditorSelection, TimelineCommand } from "@motionvideo/editor-core";
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
  const actions = buildTimelineContextActions({
    selection,
    disabled,
    canPaste,
    onCopy,
    onCut,
    onPaste,
    onExecute,
    getPlayheadTime,
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className} disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="timeline-context-menu">
        {actions.map((action) => (
          <ContextMenuItem
            key={action.id}
            disabled={action.disabled}
            onSelect={() => action.run()}
          >
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
