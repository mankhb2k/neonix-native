"use client";

import { Search } from "@/components/ui";
import { MOCK_ELEMENTS } from "@/lib/editor/sidebar-mock-library";
import { LibraryDragSource } from "../LibraryDragSource";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";

export function ElementsPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Search placeholder="Tìm kiếm thành phần..." />
      </SidebarPanelHeader>

      <SidebarPanelContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
          {MOCK_ELEMENTS.map((item) => (
            <LibraryDragSource key={item.id} draft={item}>
              <div className="aspect-square bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md flex flex-col items-center justify-center text-[var(--fg-muted)] hover:border-[var(--border-strong)] transition-colors">
                <div className="w-8 h-8 rounded-md bg-[var(--line-strong)] mb-2 flex items-center justify-center text-[11px] font-semibold text-[var(--fg-secondary)]">
                  {item.name.slice(0, 1)}
                </div>
                <span className="text-[10px] px-1 text-center leading-tight">
                  {item.name}
                </span>
              </div>
            </LibraryDragSource>
          ))}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
