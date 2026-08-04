import { memo, useState, type ReactNode } from "react";
import { Clapperboard, Layers, Music, Shapes, Smile, Type } from "lucide-react";
import type {
  EditorSelection,
  TimelineCommand,
} from "@motionvideo/editor-core";
import { PanelHeader, TabsDesktop, type DesktopTabItem } from "../../ui";
import { LibraryDragPreview } from "../library/components/LibraryDragPreview";
import { useEditorUiSession } from "../session/editor-ui-session";
import {
  EMPTY_EDITOR_VIEW_PROPS,
  type EditorSidebarProps,
} from "../workspace-props";
import type { AssetRepository } from "../../infrastructure/repositories/asset-repository";
import { AudioPanel } from "./AudioPanel/AudioPanel";
import { LayersPanel } from "./LayersPanel/LayersPanel";
import { MediaPanel } from "./MediaPanel/MediaPanel";
import { ShapesPanel } from "./ShapesPanel/ShapesPanel";
import { StickersPanel } from "./StickersPanel/StickersPanel";
import { TextPanel } from "./TextPanel/TextPanel";

export type { EditorSidebarProps };

export type SidebarProps = Partial<Omit<EditorSidebarProps, "selection">> & {
  media?: ReactNode;
  projectPath?: string | null;
  documentJson?: string;
  assetsApi?: AssetRepository;
  disabled?: boolean;
  onDocumentChange?: (json: string) => void;
  initialTab?: string;
  onSelect?: (selection: EditorSelection) => void;
  onExecuteTimeline?: (command: TimelineCommand, label: string) => void;
};

const defaultMedia = (
  <div className="flex h-full items-center justify-center p-4 text-[12px] text-[var(--fg-muted)]">
    Media library
  </div>
);

const SIDEBAR_TABS: DesktopTabItem[] = [
  {
    id: "layers",
    label: "Layers",
    icon: <Layers size={17} strokeWidth={1.5} />,
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: <Shapes size={17} strokeWidth={1.5} />,
  },

  { id: "audio", label: "Audio", icon: <Music size={17} strokeWidth={1.5} /> },
  { id: "text", label: "Text", icon: <Type size={17} strokeWidth={1.5} /> },
  {
    id: "stickers",
    label: "Stickers",
    icon: <Smile size={17} strokeWidth={1.5} />,
  },
  {
    id: "media",
    label: "Media",
    icon: <Clapperboard size={17} strokeWidth={1.5} />,
  },
];

/**
 * Ready-made library dock for {@link EditorWorkspaceFrame}.
 * Selection comes from editor-ui-session (not parent zoom/selection churn).
 */
export const Sidebar = memo(function Sidebar({
  media,
  projectPath,
  documentJson,
  assetsApi,
  disabled,
  onDocumentChange,
  lanes = EMPTY_EDITOR_VIEW_PROPS.lanes,
  clips = EMPTY_EDITOR_VIEW_PROPS.clips,
  assets = EMPTY_EDITOR_VIEW_PROPS.assets,
  initialTab = "media",
  onSelect = () => undefined,
  onExecuteTimeline = () => undefined,
}: SidebarProps) {
  const [tab, setTab] = useState(initialTab);
  const selection = useEditorUiSession((s) => s.selection);

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Editor sidebar"
      data-sidebar-tab={tab}
      data-geometry="editor-sidebar"
    >
      {/* Phần 1: Header chứa thanh điều hướng Tabs (Layers, Shapes, Media, Audio, Text, Stickers) */}
      <PanelHeader className="px-0">
        <TabsDesktop
          stacked
          value={tab}
          onChange={setTab}
          items={SIDEBAR_TABS}
        />
      </PanelHeader>

      {/* Phần 2: Khung hiển thị nội dung của Tab (Active Tab Content Viewport) */}
      {/* Div ngoài: Khung giới hạn (Clipping Container) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Div trong: Khung cuộn (Scroll Container) */}
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
          {tab === "shapes" ? (
            <ShapesPanel onExecuteTimeline={onExecuteTimeline} />
          ) : null}
          {tab === "media" ? (
            media ?? (
              assetsApi ? (
                <MediaPanel
                  projectPath={projectPath ?? null}
                  documentJson={documentJson ?? "{}"}
                  assets={assets}
                  assetsApi={assetsApi}
                  onDocumentChange={onDocumentChange ?? (() => undefined)}
                  onExecuteTimeline={onExecuteTimeline}
                />
              ) : defaultMedia
            )
          ) : null}
          {tab === "audio" ? (
            <AudioPanel
              assets={assets ?? []}
              onExecuteTimeline={onExecuteTimeline}
            />
          ) : null}
          {tab === "text" ? (
            <TextPanel onExecuteTimeline={onExecuteTimeline} />
          ) : null}
          {tab === "stickers" ? (
            <StickersPanel onExecuteTimeline={onExecuteTimeline} />
          ) : null}
        </div>
      </div>
      <LibraryDragPreview />
    </aside>
  );
});

/** @deprecated Use {@link Sidebar} */
export const EditorSidebar = Sidebar;
