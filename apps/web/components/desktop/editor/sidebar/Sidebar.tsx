"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { Frame, Shapes, Type, CloudUpload } from "lucide-react";
import { FramePanel } from "./FramePanel/FramePanel";
import { UploadPanel } from "./UploadPanel/UploadPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { TextPanel } from "./TextPanel/TextPanel";

const SIDEBAR_TABS = [
  { id: "frame", label: "Khung hình", icon: Frame },
  { id: "elements", label: "Thành phần", icon: Shapes },
  { id: "text", label: "Văn bản", icon: Type },
  { id: "upload", label: "Phương tiện", icon: CloudUpload },
] as const;

export function Sidebar() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);

  return (
    <aside className="relative flex h-full flex-col overflow-hidden [grid-area:sidebar]">
      {/* CapCut Style Top Nav Tabs */}
      <div className="flex h-11 shrink-0 items-center border-b border-[var(--line-strong)]/40 px-2 gap-1 overflow-x-auto select-none">
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSidebarTab(tab.id as any)}
              className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[var(--bg-hover)] text-[var(--accent-text)] font-semibold"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]/50"
              }`}
            >
              <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
              <span>{tab.label}</span>
              {isActive ? (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--accent-text)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Main Panel Content */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeSidebarTab === "frame" && <FramePanel />}
        {activeSidebarTab === "elements" && <ElementsPanel />}
        {activeSidebarTab === "text" && <TextPanel />}
        {activeSidebarTab === "upload" && <UploadPanel />}
      </div>
    </aside>
  );
}
