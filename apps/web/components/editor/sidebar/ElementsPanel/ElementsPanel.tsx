import React from "react";

export function ElementsPanel() {
  return (
    <div className="flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-[var(--line-strong)]">
        <h3 className="text-[14px] font-semibold text-[var(--fg)]">Thành phần</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-[var(--fg)] hover:text-[var(--fg)] text-[var(--fg-muted)]">
              <div className="w-8 h-8 rounded-full bg-[var(--line-strong)] mb-2" />
              <span className="text-[10px]">Hình {i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
