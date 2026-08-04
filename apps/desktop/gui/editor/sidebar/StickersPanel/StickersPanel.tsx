import { useState } from "react";
import { Search } from "lucide-react";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import { StickerCard } from "./StickerCard";
import { ALL_STICKERS, STICKER_CATEGORIES } from "./sticker-provider";

type Props = {
  onExecuteTimeline?: (command: TimelineCommand, label: string) => void;
};

export function StickersPanel({ onExecuteTimeline = () => undefined }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  const filteredStickers = ALL_STICKERS.filter((item) => {
    const matchesCategory =
      activeCategoryId === "all" || item.category === activeCategoryId;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.tags?.some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]">
      {/* Search Bar */}
      <div className="flex items-center p-3 pb-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[#27272a] bg-[#1c1c1f] px-2.5 py-1.5 text-zinc-400 focus-within:border-cyan-500/50">
          <Search size={13} className="shrink-0 text-zinc-400" />
          <input
            type="text"
            placeholder="Tìm sticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[11px] text-zinc-100 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1 scrollbar-none">
        {STICKER_CATEGORIES.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-[#27272a] text-cyan-400 font-semibold"
                  : "text-zinc-400 hover:bg-[#1f1f23] hover:text-zinc-200"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Sticker Grid Viewport */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredStickers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredStickers.map((item) => (
              <StickerCard key={item.id} item={item} onCommit={onCommit} />
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-[11px] text-zinc-500">
            Không tìm thấy sticker phù hợp
          </div>
        )}
      </div>
    </div>
  );
}
