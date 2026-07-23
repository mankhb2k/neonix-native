"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { FramePanel } from "./FramePanel/FramePanel";
import { UploadPanel } from "./UploadPanel/UploadPanel";
import { ElementsPanel } from "./ElementsPanel/ElementsPanel";
import { TextPanel } from "./TextPanel/TextPanel";

export function Sidebar() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);

  return (
    <aside className="relative flex flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--bg-panel)] [grid-area:sidebar]">
      <div className="w-[320px] h-full flex flex-col">
        {activeSidebarTab === "frame" && <FramePanel />}
        {activeSidebarTab === "elements" && <ElementsPanel />}
        {activeSidebarTab === "text" && <TextPanel />}
        {activeSidebarTab === "upload" && <UploadPanel />}
      </div>
    </aside>
  );
}
