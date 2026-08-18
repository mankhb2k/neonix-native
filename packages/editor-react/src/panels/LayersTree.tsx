/**
 * LayersTree — layer sidebar mirroring clipkit's `panels/LayersTree.tsx`.
 *
 * Flat-style tree: nesting is group expansion (chevron), not indented lanes.
 * Single click selects; double-click a GROUP drills in (enterGroup);
 * double-click a leaf renames. Visibility toggles `appearance.visible`.
 * ▲▼ swaps paint order (zIndex) between adjacent siblings. Group/ungroup
 * live in the header. Presentational — all mutations flow through callbacks.
 */

import { useMemo, useState } from "react";
import {
  isIdentityGroup,
  type GroupLayer,
  type MotionLayer,
} from "@motionvideo/editor-core";

export interface LayersTreeProps {
  /** Layers scoped to the current groupPath (already resolved by the host). */
  layers: readonly MotionLayer[];
  selection: readonly string[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  /** Swap paint order (zIndex) between two adjacent siblings. */
  onReorder: (movingId: string, targetId: string) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (groupId: string) => void;
  /** Double-click a group → drill in. */
  onEnterGroup?: (groupId: string) => void;
  /** Ungroup gate; defaults to isIdentityGroup (pixel-safe). */
  canUngroup?: (layer: GroupLayer) => boolean;
}

const TYPE_ICON: Record<string, string> = {
  text: "T",
  shape: "▢",
  image: "▣",
  video: "▶",
  audio: "♫",
  group: "▣",
  svg: "▣",
  solid: "▢",
  path: "▢",
  bone: "✚",
  camera: "◎",
  component: "⬡",
  adjustment: "◐",
};

function childrenOf(layer: MotionLayer): MotionLayer[] {
  return layer.type === "group" && Array.isArray(layer.children)
    ? layer.children
    : [];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={open ? "rotate-90" : ""}
      style={{ transition: "transform 120ms ease" }}
      aria-hidden="true"
    >
      <path d="M3 1.5 L7 5 L3 8.5 Z" fill="currentColor" />
    </svg>
  );
}

function Eye({ visible }: { visible: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  );
}

export function LayersTree(props: LayersTreeProps) {
  const {
    layers,
    selection,
    onSelect,
    onRename,
    onToggleVisible,
    onReorder,
    onGroup,
    onUngroup,
    onEnterGroup,
    canUngroup = isIdentityGroup,
  } = props;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const selected = useMemo(() => new Set(selection), [selection]);
  const selectedRootIds = useMemo(
    () => layers.filter((l) => selected.has(l.id)).map((l) => l.id),
    [layers, selected],
  );
  const canGroup = selectedRootIds.length >= 2;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupSelection = () => {
    if (selectedRootIds.length >= 2) onGroup(selectedRootIds);
  };

  const renderRow = (
    layer: MotionLayer,
    depth: number,
    siblings: readonly MotionLayer[],
    index: number,
  ) => {
    const children = childrenOf(layer);
    const isGroup = layer.type === "group" && children.length > 0;
    const isExpanded = expanded.has(layer.id);
    const isSelected = selected.has(layer.id);
    const isVisible =
      !("appearance" in layer) || layer.appearance?.visible !== false;
    const name = layer.name ?? layer.id;
    const isRenaming = renamingId === layer.id;
    const canMoveUp = index > 0;
    const canMoveDown = index < siblings.length - 1;

    return (
      <div key={layer.id}>
        <div
          className={`group flex items-center gap-1.5 rounded px-1.5 py-1 text-[13px] leading-none ${
            isSelected
              ? "bg-blue-600/90 text-white"
              : "text-zinc-200 hover:bg-zinc-800"
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect(layer.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (isGroup && onEnterGroup) onEnterGroup(layer.id);
            else setRenamingId(layer.id);
          }}
        >
          <button
            type="button"
            className={`flex w-3 shrink-0 items-center justify-center text-zinc-400 ${
              isGroup ? "cursor-pointer" : "invisible"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isGroup) toggleExpanded(layer.id);
            }}
            aria-label={isExpanded ? "Collapse group" : "Expand group"}
          >
            <Chevron open={isExpanded} />
          </button>

          <span className="w-4 shrink-0 text-center text-[10px] font-semibold opacity-80">
            {TYPE_ICON[layer.type] ?? "•"}
          </span>

          {isRenaming ? (
            <input
              autoFocus
              defaultValue={name}
              className="w-full rounded bg-black/40 px-1 text-[13px] text-white outline-none"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                onRename(layer.id, e.currentTarget.value.trim() || name);
                setRenamingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{name}</span>
          )}

          <button
            type="button"
            className={`shrink-0 ${
              isVisible ? "text-zinc-400" : "text-zinc-600"
            } hover:text-white`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(layer.id, !isVisible);
            }}
            aria-label={isVisible ? "Hide layer" : "Show layer"}
          >
            <Eye visible={isVisible} />
          </button>

          <button
            type="button"
            className={`shrink-0 text-zinc-500 hover:text-white ${
              canMoveUp ? "" : "invisible"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (canMoveUp) onReorder(layer.id, siblings[index - 1]!.id);
            }}
            aria-label="Move layer up"
          >
            ▲
          </button>
          <button
            type="button"
            className={`shrink-0 text-zinc-500 hover:text-white ${
              canMoveDown ? "" : "invisible"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (canMoveDown) onReorder(layer.id, siblings[index + 1]!.id);
            }}
            aria-label="Move layer down"
          >
            ▼
          </button>
        </div>

        {isGroup && isExpanded && (
          <div>
            {children.map((child, i) =>
              renderRow(child, depth + 1, children, i),
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedGroups = layers.filter(
    (l): l is GroupLayer => selected.has(l.id) && l.type === "group",
  );
  const ungroupEnabled =
    selectedGroups.length === 1 && canUngroup(selectedGroups[0]!);

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-300">
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Layers
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!canGroup}
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              canGroup
                ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                : "cursor-not-allowed text-zinc-600"
            }`}
            onClick={groupSelection}
          >
            Group
          </button>
          <button
            type="button"
            disabled={!ungroupEnabled}
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              ungroupEnabled
                ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                : "cursor-not-allowed text-zinc-600"
            }`}
            onClick={() => {
              if (ungroupEnabled) onUngroup(selectedGroups[0]!.id);
            }}
          >
            Ungroup
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {layers.map((layer, i) => renderRow(layer, 0, layers, i))}
      </div>
    </div>
  );
}
