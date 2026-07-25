import React from "react";
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from "../SidebarPanel/SidebarPanel";

export function TextPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>Văn bản</SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="flex flex-col gap-3">
          <button className="w-full py-3 bg-[var(--accent)] text-white rounded-md font-semibold text-[14px]">
            Thêm ô văn bản
          </button>

          <div className="flex flex-col gap-2 mt-4">
            <div className="w-full p-4 bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md cursor-pointer text-center">
              <span className="text-[24px] font-bold text-[var(--fg)]">Tiêu đề lớn</span>
            </div>
            <div className="w-full p-4 bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md cursor-pointer text-center">
              <span className="text-[18px] font-semibold text-[var(--fg)]">Tiêu đề phụ</span>
            </div>
            <div className="w-full p-4 bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md cursor-pointer text-center">
              <span className="text-[14px] font-normal text-[var(--fg-muted)]">Nội dung văn bản</span>
            </div>
          </div>
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
