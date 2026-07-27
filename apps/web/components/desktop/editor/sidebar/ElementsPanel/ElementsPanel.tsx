import React from "react";
import { Search } from "@/components/ui";
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from "../SidebarPanel/SidebarPanel";

export function ElementsPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Search placeholder="Tìm kiếm thành phần..." />
      </SidebarPanelHeader>
      
      <SidebarPanelContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md flex flex-col items-center justify-center cursor-pointer text-[var(--fg-muted)]"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--line-strong)] mb-2" />
              <span className="text-[10px]">Hình {i + 1}</span>
            </div>
          ))}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
