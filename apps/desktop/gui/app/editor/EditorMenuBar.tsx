import { useEffect, useRef } from "react";
import type { EditorActions } from "./editor-actions";

type Props = {
  actions: EditorActions;
};

/**
 * Editor menus routed through EditorActions — no fake IPC.
 * Outside click / Escape closes open menus.
 */
export function EditorMenuBar({ actions }: Props) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onPointer = (ev: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(ev.target as Node)) return;
      for (const details of root.querySelectorAll("details[open]")) {
        details.removeAttribute("open");
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      const root = rootRef.current;
      if (!root) return;
      for (const details of root.querySelectorAll("details[open]")) {
        details.removeAttribute("open");
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav ref={rootRef} className="editor-menubar" aria-label="Editor menu">
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
            onClick={actions.closeProject}
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
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving}
            onClick={actions.copySelection}
          >
            Copy
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving}
            onClick={actions.cutSelection}
          >
            Cut
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={actions.saving}
            onClick={actions.pasteSelection}
          >
            Paste
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
