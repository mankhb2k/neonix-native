import { Button } from "../../ui";
import { flushNameThen, type EditorActions } from "./editor-actions";
import type { ReactNode } from "react";

type Props = {
  actions: EditorActions;
  exportSlot?: ReactNode;
  transportSlot?: ReactNode;
  zoomSlot?: ReactNode;
};

export function EditorHeader({
  actions,
  exportSlot,
  transportSlot,
  zoomSlot,
}: Props) {
  return (
    <div className="editor-shell__toolbar">
      <Button
        type="button"
        variant="ghost"
        onClick={() => flushNameThen(actions, actions.goHome)}
      >
        ← Home
      </Button>
      <Button
        type="button"
        variant="primary"
        disabled={actions.saving || !actions.canSave}
        onClick={() => flushNameThen(actions, actions.save)}
      >
        Save
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={actions.saving}
        onClick={() => flushNameThen(actions, actions.saveAs)}
      >
        Save As…
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={actions.saving || !actions.canUndo}
        onClick={actions.undo}
      >
        Undo
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={actions.saving || !actions.canRedo}
        onClick={actions.redo}
      >
        Redo
      </Button>
      {exportSlot}
      {transportSlot}
      {zoomSlot}
      <label className="editor-shell__field editor-shell__field--inline">
        <span className="sr-only">Project name</span>
        <input
          aria-label="Project name"
          value={actions.nameDraft}
          onChange={(e) => actions.setNameDraft(e.target.value)}
          onBlur={() => actions.commitProjectName()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              actions.skipNameCommit();
              actions.rollbackProjectName();
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={actions.saving}
        />
      </label>
      <span className="editor-shell__meta">
        {actions.path ?? "Unsaved"}
        {actions.dirty ? " (unsaved changes)" : ""}
        {actions.saving ? " · Saving…" : ""}
      </span>
    </div>
  );
}
