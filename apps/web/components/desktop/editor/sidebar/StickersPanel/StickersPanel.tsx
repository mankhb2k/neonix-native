"use client";

import { Search } from "@/components/ui";
import { MOCK_STICKERS } from "@/lib/editor/sidebar-mock-library";
import { LibraryDragSource } from "../LibraryDragSource";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";

export function StickersPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Search placeholder="Tìm kiếm nhãn dán..." />
      </SidebarPanelHeader>

      <SidebarPanelContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
          {MOCK_STICKERS.map((item) => (
            <LibraryDragSource key={item.id} draft={item}>
              <div className="aspect-square bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md flex flex-col items-center justify-center hover:border-[var(--border-strong)] transition-colors">
                <span className="text-[28px] leading-none mb-1">{item.text}</span>
                <span className="text-[10px] text-[var(--fg-muted)] px-1 truncate w-full text-center">
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
