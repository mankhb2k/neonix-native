import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import type { DocumentAssetEntry } from "../../assets/document-assets";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import { AudioCard } from "./AudioCard";
import { AUDIO_CATEGORIES, DEMO_AUDIO_ITEMS } from "./audio-data";
import type { AudioCategoryKey, AudioItem } from "./types";

type Props = {
  assets: DocumentAssetEntry[];
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

export function AudioPanel({ assets, onExecuteTimeline }: Props) {
  const [activeCategory, setActiveCategory] =
    useState<AudioCategoryKey>("sfx");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(
    null,
  );
  const [expandedDropdowns, setExpandedDropdowns] = useState<
    Record<string, boolean>
  >({
    yours: true,
    music: true,
    sfx: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Convert project assets to AudioItems
  const projectAudioItems: AudioItem[] = assets
    .filter((a) => a.assetType === "audio")
    .map((asset) => {
      const fileName = asset.uri.split("/").pop() ?? asset.id;
      const title = fileName.replace(/\.[^.]+$/, "") || fileName;
      return {
        id: asset.id,
        title,
        artist: "Uploaded",
        duration:
          typeof asset.duration === "number" && asset.duration > 0
            ? asset.duration
            : 5,
        category: "import",
        assetId: asset.id,
        uri: asset.uri,
      };
    });

  const allItems: AudioItem[] = [
    ...projectAudioItems,
    ...DEMO_AUDIO_ITEMS.map((item) => ({
      ...item,
      isFavorite: favorites.has(item.id),
    })),
  ];

  // Filter items by category & search query
  const filteredItems = allItems.filter((item) => {
    const matchesCategory = item.category === activeCategory;

    const matchesSub = activeSubCategory
      ? item.subCategory === activeSubCategory
      : true;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query
      ? item.title.toLowerCase().includes(query) ||
        (item.artist && item.artist.toLowerCase().includes(query))
      : true;

    return matchesCategory && matchesSub && matchesSearch;
  });

  const toggleDropdown = (key: string) => {
    setExpandedDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#121214]">
      {/* Side 1: Left Sub-sidebar (Category Navigation) */}
      <div className="flex w-[125px] shrink-0 flex-col gap-1 border-r border-[#27272a] bg-[#17171a] p-1.5 overflow-y-auto text-left select-none">
        {AUDIO_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const isExpanded = !!expandedDropdowns[cat.key];

          return (
            <div key={cat.key} className="flex flex-col">
              <button
                type="button"
                className={`group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-[#27272a] text-cyan-400 font-semibold"
                    : "text-zinc-400 hover:bg-[#222225] hover:text-zinc-200"
                }`}
                onClick={() => {
                  setActiveCategory(cat.key);
                  setActiveSubCategory(null);
                  if (cat.hasDropdown) toggleDropdown(cat.key);
                }}
              >
                <span className="truncate">{cat.label}</span>
                {cat.hasDropdown ? (
                  isExpanded ? (
                    <ChevronDown size={12} className="shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronRight
                      size={12}
                      className="shrink-0 text-zinc-500"
                    />
                  )
                ) : null}
              </button>

              {/* Sub-categories dropdown items */}
              {cat.hasDropdown && isExpanded && cat.subCategories ? (
                <div className="ml-2 flex flex-col gap-0.5 border-l border-zinc-800 pl-1.5 my-0.5">
                  {cat.subCategories.map((sub) => {
                    const isSubActive =
                      isActive && activeSubCategory === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        className={`truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                          isSubActive
                            ? "font-semibold text-cyan-400"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                        onClick={() => {
                          setActiveCategory(cat.key);
                          setActiveSubCategory(sub);
                        }}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Side 2: Right Content Viewport (Audio List & Search) */}
      <div className="flex flex-1 min-w-0 flex-col h-full bg-[#121214]">
        {/* Top Header / Banner Area */}
        {activeCategory === "import" ? (
          <div className="p-2 border-b border-[#27272a] bg-[#18181b]">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-[#27272a] px-3 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#323236] transition-colors"
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>Extract audio</span>
              <span className="rounded bg-purple-500/20 px-1 py-0.2 text-[9px] font-semibold text-purple-300">
                1 use
              </span>
            </button>
          </div>
        ) : null}

        {/* Search Bar */}
        <div className="flex items-center gap-1.5 p-2 border-b border-[#27272a]">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[#27272a] bg-[#1c1c1f] px-2 py-1 text-zinc-400 focus-within:border-cyan-500/50">
            <Search size={13} className="shrink-0 text-zinc-400" />
            <input
              type="text"
              placeholder="People are searching typing"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-[11px] text-zinc-100 placeholder-zinc-500 outline-none"
            />
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#27272a] bg-[#1c1c1f] text-zinc-400 hover:text-zinc-200"
            title="Filter"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>

        {/* Audio List Viewport */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <AudioCard
                key={item.id}
                item={item}
                onCommit={onCommit}
                onToggleFavorite={toggleFavorite}
              />
            ))
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-zinc-500">
              <span className="text-[12px]">No audio items found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
