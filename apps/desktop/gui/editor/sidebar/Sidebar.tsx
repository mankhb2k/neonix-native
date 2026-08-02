import { useState, type ReactNode } from "react";
import { PanelHeader, TabsDesktop } from "../../ui";
import { LibraryDragPreview } from "../library/components/LibraryDragPreview";
import {
  EMPTY_EDITOR_VIEW_PROPS,
  type EditorSidebarProps,
} from "../workspace-props";
import { AudioPanel } from "./AudioPanel/AudioPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { LayersPanel } from "./LayersPanel/LayersPanel";
import { MediaPanel } from "./MediaPanel/MediaPanel";
import { TextPanel } from "./TextPanel/TextPanel";

export type { EditorSidebarProps };

export type SidebarProps = Partial<EditorSidebarProps> & {
  media?: ReactNode;
  initialTab?: string;
};

const defaultMedia = (
  <div className="flex h-full items-center justify-center p-4 text-[12px] text-[var(--fg-muted)]">
    Media library
  </div>
);

/**
 * Ready-made library dock for {@link EditorWorkspaceFrame}.
 * Pass full session props from EditingWorkspace; omit for empty shell mount.
 */
export function Sidebar({
  media = defaultMedia,
  lanes = EMPTY_EDITOR_VIEW_PROPS.lanes,
  clips = EMPTY_EDITOR_VIEW_PROPS.clips,
  selection = EMPTY_EDITOR_VIEW_PROPS.selection,
  assets = EMPTY_EDITOR_VIEW_PROPS.assets,
  initialTab = "media",
  onSelect = () => undefined,
  onExecuteTimeline = () => undefined,
}: SidebarProps) {
  const [tab, setTab] = useState(initialTab);

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Editor sidebar"
      data-sidebar-tab={tab}
      data-geometry="editor-sidebar"
    >
      <PanelHeader title="Library" />
      <div className="shrink-0 border-b border-[var(--border-subtle)]">
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
      <div className="min-h-0 flex-1 overflow-auto">
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
            assets={assets ?? []}
            onExecuteTimeline={onExecuteTimeline}
          />
        ) : null}
      </div>
      <LibraryDragPreview />
    </aside>
  );
}

/** @deprecated Use {@link Sidebar} */
export const EditorSidebar = Sidebar;
