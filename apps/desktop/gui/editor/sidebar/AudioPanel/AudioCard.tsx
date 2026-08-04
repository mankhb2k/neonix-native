import { Music, Plus, Star, Sparkles } from "lucide-react";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import type { AudioItem } from "./types";

type AudioCardProps = {
  item: AudioItem;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
  onToggleFavorite?: (id: string) => void;
};

export function AudioCard({ item, onCommit, onToggleFavorite }: AudioCardProps) {
  const payload: LibraryPayload = {
    kind: "audio",
    id: item.id,
    label: item.title,
    assetId: item.assetId ?? item.id,
    uri: item.uri ?? `demo://audio/${item.id}.mp3`,
    duration: item.duration,
  };

  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(
    payload,
    onCommit,
  );

  const formattedTime =
    item.duration >= 60
      ? `${Math.floor(item.duration / 60).toString().padStart(2, "0")}:${Math.floor(item.duration % 60)
          .toString()
          .padStart(2, "0")}`
      : `00:${Math.floor(item.duration).toString().padStart(2, "0")}`;

  return (
    <div
      tabIndex={0}
      role="button"
      className="group relative flex w-full cursor-grab select-none items-center gap-2.5 rounded-lg border border-transparent bg-[#1f1f23] p-2 hover:border-[#3f3f46] hover:bg-[#27272a] active:cursor-grabbing transition-all"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {/* Avatar / Icon */}
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2a2a30] group-hover:bg-[#36363d]">
        {item.isPro ? (
          <Sparkles size={16} className="text-cyan-400" />
        ) : (
          <Music size={16} className="text-zinc-300 group-hover:text-cyan-400 transition-colors" />
        )}
      </div>

      {/* Title & Subtitle Info */}
      <div className="flex flex-1 min-w-0 flex-col text-left">
        <span
          className="truncate text-[12px] font-medium text-zinc-100 group-hover:text-white"
          title={item.title}
        >
          {item.title}
        </span>
        <span className="truncate text-[10px] text-zinc-400">
          {item.artist ? `${item.artist} · ` : ""}{formattedTime}
        </span>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:text-amber-400 hover:bg-zinc-700/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(item.id);
          }}
          title="Favorite"
        >
          <Star
            size={13}
            className={item.isFavorite ? "fill-amber-400 text-amber-400" : ""}
          />
        </button>
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2a30] text-zinc-300 group-hover:bg-cyan-500 group-hover:text-zinc-950 transition-colors"
          title="Add to timeline"
        >
          <Plus size={14} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
