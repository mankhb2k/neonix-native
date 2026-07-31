import { useState, type ReactNode } from "react";
import { PanelHeader, TabsDesktop } from "../../ui";
import { LibraryDragPreview } from "../library/components/LibraryDragPreview";
import { AudioPanel } from "./AudioPanel/AudioPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { LayersPanel } from "./LayersPanel/LayersPanel";
import { MediaPanel } from "./MediaPanel/MediaPanel";
import { TextPanel } from "./TextPanel/TextPanel";
import type { DocumentAssetEntry } from "../assets/document-assets";
import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import "./sidebar.css";

type Props = {
  media: ReactNode;
  lanes: TimelineLane[];
  clips: TimelineClip[];
  selection: EditorSelection;
  assets?: DocumentAssetEntry[];
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

export function EditorSidebar({
  media,
  lanes,
  clips,
  selection,
  assets = [],
  onSelect,
  onExecuteTimeline,
}: Props) {
  const [tab, setTab] = useState("media");

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
          <LayersPanel
            lanes={lanes}
            clips={clips}
            selection={selection}
            onSelect={onSelect}
            onExecuteTimeline={onExecuteTimeline}
          />
        ) : null}
        {tab === "media" ? <MediaPanel media={media} /> : null}
        {tab === "text" ? (
          <TextPanel onExecuteTimeline={onExecuteTimeline} />
        ) : null}
        {tab === "elements" ? (
          <ElementsPanel onExecuteTimeline={onExecuteTimeline} />
        ) : null}
        {tab === "audio" ? (
          <AudioPanel
            assets={assets}
            onExecuteTimeline={onExecuteTimeline}
          />
        ) : null}
      </div>
      <LibraryDragPreview />
    </aside>
  );
}
