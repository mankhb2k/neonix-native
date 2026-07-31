"use client";

import { MOCK_TEXTS } from "@/lib/editor/sidebar-mock-library";
import { LibraryDragSource } from "../LibraryDragSource";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";

const TEXT_STYLE: Record<string, string> = {
  mock_txt_title: "text-[24px] font-bold text-[var(--fg)]",
  mock_txt_subtitle: "text-[18px] font-semibold text-[var(--fg)]",
  mock_txt_body: "text-[14px] font-normal text-[var(--fg-muted)]",
  mock_txt_caption: "text-[13px] font-medium text-[var(--fg-secondary)]",
  mock_txt_cta: "text-[16px] font-semibold text-[var(--accent)]",
};

export function TextPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>Văn bản</SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="w-full py-3 bg-[var(--accent)] text-white rounded-md font-semibold text-[14px]"
          >
            Thêm ô văn bản
          </button>

          <div className="flex flex-col gap-2 mt-2">
            {MOCK_TEXTS.map((item) => (
              <LibraryDragSource key={item.id} draft={item}>
                <div className="w-full p-4 bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md text-center hover:border-[var(--border-strong)] transition-colors">
                  <span className={TEXT_STYLE[item.id] ?? "text-[14px] text-[var(--fg)]"}>
                    {item.text}
                  </span>
                  {item.subtitle ? (
                    <div className="mt-1 text-[10px] text-[var(--fg-muted)]">
                      {item.subtitle} · {item.duration}s
                    </div>
                  ) : null}
                </div>
              </LibraryDragSource>
            ))}
          </div>
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
