"use client";

import { Home, Sparkles, Plus, FolderOpen } from "lucide-react";

type Props = {
  onCreateNew: () => void;
  onOpen: () => void;
};

export function DesktopHubSidebar({ onCreateNew, onOpen }: Props) {
  return (
    <aside className="w-[190px] shrink-0 bg-[#141416] p-4 flex flex-col justify-between select-none border-r border-[#222225]">
      <div className="flex flex-col gap-6">
        {/* Navigation List */}
        <nav className="flex flex-col gap-1">
          {/* Active Home Pill */}
          <button
            type="button"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#2a2a2e] text-white font-medium text-[13px] shadow-sm cursor-pointer"
          >
            <Home size={15} />
            <span>Trang chủ</span>
          </button>

          {/* Learn / Templates */}
          <button
            type="button"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[#909095] hover:text-white hover:bg-[#222225] font-normal text-[13px] transition-colors cursor-pointer"
          >
            <Sparkles size={15} />
            <span>Mẫu TVC</span>
          </button>
        </nav>

        {/* Action Pill Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="w-full py-1.5 px-4 rounded-full border border-[#404045] bg-[#d9381e] text-white text-[12px] font-medium hover:bg-[#b92b15] transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            <span>Tạo dự án mới</span>
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="w-full py-1.5 px-4 rounded-full border border-[#35353a] bg-transparent text-[#cccccc] text-[12px] font-medium hover:bg-[#222225] hover:text-white transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <FolderOpen size={14} />
            <span>Mở file</span>
          </button>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-[11px] text-[#55555a] font-mono">
        MotionVideo v2.0
      </div>
    </aside>
  );
}
