"use client";

import { useEditorStore, type SidebarTabId } from "@/lib/store/editor-store";
import { PanelHeader, TabsDesktop, type DesktopTabItem } from "@/components/ui";
import {
  Layers,
  Shapes,
  Type,
  CloudUpload,
  Smile,
  Music,
} from "lucide-react";
import { LayersPanel } from "./LayersPanel/LayersPanel";
import { UploadPanel } from "./UploadPanel/UploadPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { TextPanel } from "./TextPanel/TextPanel";
import { AudioPanel } from "./AudioPanel/AudioPanel";

const SIDEBAR_TABS: DesktopTabItem[] = [
  { id: "frame", label: "Lớp", icon: <Layers size={17} /> },
  { id: "elements", label: "Thành phần", icon: <Shapes size={17} /> },
  { id: "text", label: "Văn bản", icon: <Type size={17} /> },
  { id: "upload", label: "Phương tiện", icon: <CloudUpload size={17} /> },
  { id: "stickers", label: "Nhãn dán", icon: <Smile size={17} /> },
  { id: "audio", label: "Âm thanh", icon: <Music size={17} /> },
];

export function Sidebar() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden [grid-area:sidebar]">
      <PanelHeader className="px-0">
        <TabsDesktop
          stacked
          items={SIDEBAR_TABS}
          value={activeSidebarTab}
          onChange={(id) => setActiveSidebarTab(id as SidebarTabId)}
        />
      </PanelHeader>

      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeSidebarTab === "frame" && <LayersPanel />}
        {activeSidebarTab === "elements" && <ElementsPanel />}
        {activeSidebarTab === "text" && <TextPanel />}
        {activeSidebarTab === "upload" && <UploadPanel />}
        {activeSidebarTab === "stickers" && <ElementsPanel />}
        {activeSidebarTab === "audio" && <AudioPanel />}
      </div>
    </aside>
  );
}
