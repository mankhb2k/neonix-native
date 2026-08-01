import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../ui";
import { EditorMenuBar } from "./EditorMenuBar";
import type { EditorActions } from "./editor-actions";

type Props = {
  actions: EditorActions;
  exportSlot?: ReactNode;
  transportSlot?: ReactNode;
  zoomSlot?: ReactNode;
};

/**
 * Editor toolbar chrome. File/Edit/View menus portal into the TitleBar
 * portal host for a single top chrome strip.
 */
export function EditorHeader({
  actions,
  exportSlot,
  transportSlot,
  zoomSlot,
}: Props) {
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMenuHost(document.getElementById("desktop-titlebar-menu-portal"));
  }, []);

  return (
    <div className="editor-shell__chrome">
      {menuHost
        ? createPortal(<EditorMenuBar actions={actions} />, menuHost)
        : (
            <EditorMenuBar actions={actions} />
          )}
      <div className="editor-shell__toolbar" role="toolbar" aria-label="Editor">
        <Button type="button" variant="ghost" onClick={actions.closeProject}>
          ← Home
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={actions.saving || !actions.canSave}
          onClick={actions.save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={actions.saving}
          onClick={actions.saveAs}
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
    </div>
  );
}
