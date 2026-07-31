import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  DEFAULT_FRAME_DURATION,
  selectionNone,
  type EditorSelection,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { PanelHeader, TabsDesktop } from "../../ui";
import { libraryItemToFrameDraft } from "../library/adapters/library-to-frame-draft";
import { LibraryDragPreview } from "../library/components/LibraryDragPreview";
import {
  beginLibraryDrag,
  cancelLibraryDrag,
  endLibraryDrag,
  moveLibraryDrag,
} from "../library/interactions/library-drag-session";
import type { DocumentAssetEntry } from "../assets/document-assets";
import type { LibraryItem } from "../library/model/library-item";
import "./sidebar.css";

const TEXT_PRESETS: LibraryItem[] = [
  {
    id: "text-title",
    kind: "text",
    label: "Title",
    text: "Title",
    duration: DEFAULT_FRAME_DURATION,
  },
  {
    id: "text-subtitle",
    kind: "text",
    label: "Subtitle",
    text: "Subtitle",
    duration: 4,
  },
];

const ELEMENT_PRESETS: LibraryItem[] = [
  {
    id: "el-rect",
    kind: "element",
    label: "Rectangle",
    text: "▮",
    duration: DEFAULT_FRAME_DURATION,
  },
  {
    id: "el-circle",
    kind: "element",
    label: "Circle",
    text: "●",
    duration: DEFAULT_FRAME_DURATION,
  },
];

type Props = {
  media: ReactNode;
  lanes: TimelineLane[];
  selection: EditorSelection;
  assets?: DocumentAssetEntry[];
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

export function EditorSidebar({
  media,
  lanes,
  selection,
  assets = [],
  onSelect,
  onExecuteTimeline,
}: Props) {
  const [tab, setTab] = useState("media");
  const sorted = [...lanes].sort((a, b) => a.order - b.order);
  const audioAssets = assets.filter((a) => a.assetType === "audio");

  const commitLibraryItem = (item: LibraryItem) => {
    const draft = libraryItemToFrameDraft(item);
    onExecuteTimeline(
      {
        type: "add-clip-draft",
        draft,
        target: { track: "main" },
      },
      `Add ${item.label}`,
    );
  };

  const onLibraryPointerDown = (
    item: LibraryItem,
    e: ReactPointerEvent,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    beginLibraryDrag(item, e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => moveLibraryDrag(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const dropped = endLibraryDrag();
      if (dropped) commitLibraryItem(dropped);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cancelLibraryDrag();
    });
  };

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
            { id: "text", label: "Text" },
            { id: "elements", label: "Elements" },
            { id: "audio", label: "Audio" },
          ]}
        />
      </div>
      <div className="editor-sidebar__body">
        {tab === "layers" ? (
          <ul className="editor-sidebar__layers">
            {sorted.map((lane) => (
              <li key={lane.id}>
                <div className="editor-sidebar__lane-row">
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
                  <button
                    type="button"
                    className="editor-sidebar__flag"
                    title="Toggle lock"
                    onClick={() =>
                      onExecuteTimeline(
                        {
                          type: "update-lane-flags",
                          laneId: lane.id,
                          patch: { locked: !lane.locked },
                        },
                        lane.locked ? "Unlock lane" : "Lock lane",
                      )
                    }
                  >
                    {lane.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
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
        {tab === "text" ? (
          <ul className="editor-sidebar__presets">
            {TEXT_PRESETS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="editor-sidebar__preset"
                  onClick={() => commitLibraryItem(item)}
                  onPointerDown={(e) => onLibraryPointerDown(item, e)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "elements" ? (
          <ul className="editor-sidebar__presets">
            {ELEMENT_PRESETS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="editor-sidebar__preset"
                  onClick={() => commitLibraryItem(item)}
                  onPointerDown={(e) => onLibraryPointerDown(item, e)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "audio" ? (
          audioAssets.length === 0 ? (
            <p className="editor-sidebar__hint">
              Import audio via Media after saving the project.
            </p>
          ) : (
            <ul className="editor-sidebar__presets">
              {audioAssets.map((asset) => {
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className="editor-sidebar__preset"
                      onClick={() =>
                        onExecuteTimeline(
                          {
                            type: "add-audio-clip",
                            item: {
                              title: asset.id,
                              assetId: asset.id,
                              src: asset.uri,
                              duration: DEFAULT_FRAME_DURATION,
                            },
                            target: { track: "audio" },
                          },
                          `Add audio ${asset.id}`,
                        )
                      }
                    >
                      {asset.id}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </div>
      <LibraryDragPreview />
    </aside>
  );
}
