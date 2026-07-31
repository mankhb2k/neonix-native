import type { EditorActions } from "./editor-actions";

type Props = {
  actions: EditorActions;
};

/**
 * Editor menus routed through EditorActions (N3) — no fake IPC.
 */
export function EditorMenuBar({ actions }: Props) {
  return (
    <nav className="editor-menubar" aria-label="Editor menu">
      <details className="editor-menubar__menu">
        <summary className="editor-menubar__trigger">File</summary>
        <div className="editor-menubar__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving || !actions.canSave}
            onClick={actions.save}
          >
            Save
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving}
            onClick={actions.saveAs}
          >
            Save As…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void actions.flushDocumentSnapshot();
              actions.goHome();
            }}
          >
            Close Project
          </button>
        </div>
      </details>
      <details className="editor-menubar__menu">
        <summary className="editor-menubar__trigger">Edit</summary>
        <div className="editor-menubar__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving || !actions.canUndo}
            onClick={actions.undo}
          >
            Undo
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving || !actions.canRedo}
            onClick={actions.redo}
          >
            Redo
          </button>
        </div>
      </details>
      <details className="editor-menubar__menu">
        <summary className="editor-menubar__trigger">View</summary>
        <div className="editor-menubar__panel" role="menu">
          <button type="button" role="menuitem" onClick={actions.fitTimeline}>
            Fit timeline
          </button>
        </div>
      </details>
    </nav>
  );
}
