"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { PanelHeader, TabsDesktop, type DesktopTabItem } from "@/components/ui";
import {
  Frame,
  Shapes,
  Type,
  CloudUpload,
  Smile,
  Music,
} from "lucide-react";
import { FramePanel } from "./FramePanel/FramePanel";
import { UploadPanel } from "./UploadPanel/UploadPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { TextPanel } from "./TextPanel/TextPanel";
import { AudioPanel } from "./AudioPanel/AudioPanel";

const SIDEBAR_TABS: DesktopTabItem[] = [
  { id: "frame", label: "Khung hình", icon: <Frame size={17} /> },
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
      {/* CapCut Style Desktop Stacked Tabs (Icon top, Text below) within standard h-[40px] header */}
      <PanelHeader className="px-0">
        <TabsDesktop
          stacked
          items={SIDEBAR_TABS}
          value={activeSidebarTab}
          onChange={(id) => setActiveSidebarTab(id as any)}
        />
      </PanelHeader>

      {/* Main Panel Content */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeSidebarTab === "frame" && <FramePanel />}
        {activeSidebarTab === "elements" && <ElementsPanel />}
        {activeSidebarTab === "text" && <TextPanel />}
        {activeSidebarTab === "upload" && <UploadPanel />}
        {activeSidebarTab === "stickers" && <ElementsPanel />}
        {activeSidebarTab === "audio" && <AudioPanel />}
      </div>
    </aside>
  );
}
