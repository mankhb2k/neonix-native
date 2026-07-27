"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { TabsDesktop, type DesktopTabItem } from "@/components/ui";
import {
  Frame,
  Shapes,
  Type,
  CloudUpload,
  Smile,
  Sparkles,
  ArrowLeftRight,
  Sliders,
  Settings2,
} from "lucide-react";
import { FramePanel } from "./FramePanel/FramePanel";
import { UploadPanel } from "./UploadPanel/UploadPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { TextPanel } from "./TextPanel/TextPanel";

const SIDEBAR_TABS: DesktopTabItem[] = [
  { id: "frame", label: "Khung hình", icon: <Frame size={15} /> },
  { id: "elements", label: "Thành phần", icon: <Shapes size={15} /> },
  { id: "text", label: "Văn bản", icon: <Type size={15} /> },
  { id: "upload", label: "Phương tiện", icon: <CloudUpload size={15} /> },
  { id: "stickers", label: "Nhãn dán", icon: <Smile size={15} /> },
  { id: "effects", label: "Hiệu ứng", icon: <Sparkles size={15} /> },
  { id: "transitions", label: "Chuyển cảnh", icon: <ArrowLeftRight size={15} /> },
  { id: "filters", label: "Bộ lọc", icon: <Sliders size={15} /> },
  { id: "adjustment", label: "Điều chỉnh", icon: <Settings2 size={15} /> },
];

export function Sidebar() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);

  return (
    <aside className="relative flex h-full flex-col overflow-hidden [grid-area:sidebar]">
      {/* CapCut Style Desktop Tabs with overflow Chevron scroll buttons */}
      <div className="shrink-0 border-b border-[var(--line-strong)]/40">
        <TabsDesktop
          items={SIDEBAR_TABS}
          value={activeSidebarTab}
          onChange={(id) => setActiveSidebarTab(id as any)}
        />
      </div>

      {/* Main Panel Content */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeSidebarTab === "frame" && <FramePanel />}
        {activeSidebarTab === "elements" && <ElementsPanel />}
        {activeSidebarTab === "text" && <TextPanel />}
        {activeSidebarTab === "upload" && <UploadPanel />}
        {activeSidebarTab !== "frame" &&
          activeSidebarTab !== "elements" &&
          activeSidebarTab !== "text" &&
          activeSidebarTab !== "upload" && <UploadPanel />}
      </div>
    </aside>
  );
}
