import { useState, type ReactNode } from "react";
import {
  Clapperboard,
  Layers,
  Music,
  Smile,
  Type,
} from "lucide-react";
import { PanelHeader, TabsDesktop, type DesktopTabItem } from "../../ui";
import { LibraryDragPreview } from "../library/components/LibraryDragPreview";
import {
  EMPTY_EDITOR_VIEW_PROPS,
  type EditorSidebarProps,
} from "../workspace-props";
import { AudioPanel } from "./AudioPanel/AudioPanel";
import { LayersPanel } from "./LayersPanel/LayersPanel";
import { MediaPanel } from "./MediaPanel/MediaPanel";
import { StickersPanel } from "./StickersPanel/StickersPanel";
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

const SIDEBAR_TABS: DesktopTabItem[] = [
  { id: "layers", label: "Layers", icon: <Layers size={17} strokeWidth={1.5} /> },
  {
    id: "media",
    label: "Media",
    icon: <Clapperboard size={17} strokeWidth={1.5} />,
  },
  { id: "audio", label: "Audio", icon: <Music size={17} strokeWidth={1.5} /> },
  { id: "text", label: "Text", icon: <Type size={17} strokeWidth={1.5} /> },
  {
    id: "stickers",
    label: "Stickers",
    icon: <Smile size={17} strokeWidth={1.5} />,
  },
];

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
      <PanelHeader className="px-0">
        <TabsDesktop
          stacked
          value={tab}
          onChange={setTab}
          items={SIDEBAR_TABS}
        />
      </PanelHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          {tab === "audio" ? (
            <AudioPanel
              assets={assets ?? []}
              onExecuteTimeline={onExecuteTimeline}
            />
          ) : null}
          {tab === "text" ? (
            <TextPanel onExecuteTimeline={onExecuteTimeline} />
          ) : null}
          {tab === "stickers" ? <StickersPanel /> : null}
        </div>
      </div>
      <LibraryDragPreview />
    </aside>
  );
}

/** @deprecated Use {@link Sidebar} */
export const EditorSidebar = Sidebar;
