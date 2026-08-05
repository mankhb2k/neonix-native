import type { DragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Square,
  Image as ImageIcon,
  Music,
  Film,
  Camera,
  Layers,
  SquareDashed,
} from "lucide-react";
import type { LayerTreeRow } from "../../timeline/layer-mode/build-layer-tree";
import { cn } from "../../../ui";

const INDENT_PX = 12;

function nodeTypeIcon(type: string) {
  switch (type) {
    case "group":
      return (
        <SquareDashed size={14} className="shrink-0 text-zinc-400" strokeWidth={1.5} />
      );
    case "text":
      return <Type size={14} className="shrink-0 text-sky-400" />;
    case "shape":
    case "solid":
    case "path":
      return <Square size={14} className="shrink-0 text-sky-300" />;
    case "image":
    case "svg":
      return <ImageIcon size={14} className="shrink-0 text-sky-300" />;
    case "video":
      return <Film size={14} className="shrink-0 text-sky-300" />;
    case "camera":
      return <Camera size={14} className="shrink-0 text-amber-400" />;
    case "audio":
      return <Music size={14} className="shrink-0 text-sky-400" />;
    default:
      return <Layers size={14} className="shrink-0 text-zinc-400" />;
  }
}

type Props = {
  row: LayerTreeRow;
  selected: boolean;
  expanded: boolean;
  locked: boolean;
  dragging: boolean;
  dropEdge: "before" | "after" | null;
  onSelect: () => void;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
};

export function LayerTreeRowView({
  row,
  selected,
  expanded,
  locked,
  dragging,
  dropEdge,
  onSelect,
  onToggleExpand,
  onToggleVisible,
  onToggleLock,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={row.hasChildren ? expanded : undefined}
      draggable={!locked}
      data-testid="layer-tree-row"
      data-depth={row.depth}
      data-node-id={row.id}
      data-node-type={row.type}
      data-drop-edge={dropEdge ?? undefined}
      className={cn(
        "group relative flex h-7 w-full cursor-default items-center gap-0.5 pr-1 text-left transition-colors",
        selected ? "bg-zinc-700/55" : "hover:bg-zinc-800/70",
        !row.visible && "opacity-50",
        dragging && "opacity-40",
        locked && "cursor-not-allowed",
      )}
      style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
    >
      {dropEdge === "before" ? (
        <div
          data-testid="layer-tree-drop-line"
          className="pointer-events-none absolute inset-x-1 top-0 z-10 h-px bg-[#14B8A6]"
          aria-hidden
        />
      ) : null}
      {dropEdge === "after" ? (
        <div
          data-testid="layer-tree-drop-line"
          className="pointer-events-none absolute inset-x-1 bottom-0 z-10 h-px bg-[#14B8A6]"
          aria-hidden
        />
      ) : null}

      {row.hasChildren ? (
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          data-testid="layer-tree-chevron"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
      )}

      <span className="mr-1.5 flex shrink-0 items-center">
        {nodeTypeIcon(row.type)}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-100">
        {row.name}
      </span>

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 text-zinc-400",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          className="rounded p-1 hover:bg-zinc-700 hover:text-zinc-200"
          title={locked ? "Unlock" : "Lock"}
          data-testid="layer-tree-lock"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
        >
          {locked ? (
            <Lock size={12} className="text-amber-400" />
          ) : (
            <Unlock size={12} />
          )}
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-zinc-700 hover:text-zinc-200"
          title={row.visible ? "Hide" : "Show"}
          data-testid="layer-tree-eye"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
        >
          {row.visible ? (
            <Eye size={12} />
          ) : (
            <EyeOff size={12} className="text-red-400" />
          )}
        </button>
      </div>
    </div>
  );
}
