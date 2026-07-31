import { useState, type ReactNode } from "react";
import {
  selectionNone,
  type EditorSelection,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { PanelHeader, TabsDesktop } from "../../ui";
import "./sidebar.css";

type Props = {
  media: ReactNode;
  lanes: TimelineLane[];
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
};

/**
 * Sidebar vertical slices shell (UI-5).
 * Layers + Media wired; Elements/Audio placeholders (no mock library).
 */
export function EditorSidebar({ media, lanes, selection, onSelect }: Props) {
  const [tab, setTab] = useState("media");
  const sorted = [...lanes].sort((a, b) => a.order - b.order);

  return (
    <aside className="editor-sidebar" aria-label="Editor sidebar">
      <PanelHeader title="Library" />
      <div className="editor-sidebar__tabs">
        <TabsDesktop
          value={tab}
          onChange={setTab}
          items={[
            { id: "layers", label: "Layers" },
            { id: "media", label: "Media" },
            { id: "elements", label: "Elements", disabled: true },
            { id: "audio", label: "Audio", disabled: true },
          ]}
        />
      </div>
      <div className="editor-sidebar__body">
        {tab === "layers" ? (
          <ul className="editor-sidebar__layers">
            {sorted.map((lane) => (
              <li key={lane.id}>
                <button
                  type="button"
                  className="editor-sidebar__lane"
                  onClick={() => onSelect(selectionNone())}
                  title={lane.kind}
                >
                  <span>{lane.name}</span>
                  <span className="editor-sidebar__lane-meta">
                    {lane.kind}
                    {lane.locked ? " · locked" : ""}
                  </span>
                </button>
              </li>
            ))}
            {selection.kind !== "none" ? (
              <li className="editor-sidebar__hint">
                Selection active — clear via empty timeline click.
              </li>
            ) : null}
          </ul>
        ) : null}
        {tab === "media" ? media : null}
        {tab === "elements" || tab === "audio" ? (
          <p className="editor-sidebar__hint">
            Coming in a later vertical slice — no mock library shipped.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
