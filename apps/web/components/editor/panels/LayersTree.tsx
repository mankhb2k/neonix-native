/**
 * LayersTree — layer sidebar.
 *
 * Single click selects; double-click group drills in / leaf renames.
 * Visibility + lock icons on each row. Reorder: press-drag a row (siblings only).
 * Group/ungroup in the header.
 */

"use client";

import { Lock, Unlock } from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  isIdentityGroup,
  type GroupLayer,
  type MotionLayer,
} from "@motionvideo/editor-core";

export interface LayersTreeProps {
  layers: readonly MotionLayer[];
  selection: readonly string[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  isLocked: (id: string) => boolean;
  onToggleLock: (id: string, locked: boolean) => void;
  onReorder: (
    movingId: string,
    targetId: string,
    edge: "before" | "after",
  ) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (groupId: string) => void;
  onEnterGroup?: (groupId: string) => void;
  canUngroup?: (layer: GroupLayer) => boolean;
  /** Display label from envelope — falls back to layer id. */
  resolveDisplayName?: (layer: MotionLayer) => string;
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

const DRAG_THRESHOLD_PX = 5;

type DragSession = {
  layerId: string;
  siblingIds: ReadonlySet<string>;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  suppressClick: boolean;
};

type DropHint = {
  targetId: string;
  edge: "before" | "after";
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
    isLocked,
    onToggleLock,
    onReorder,
    onGroup,
    onUngroup,
    onEnterGroup,
    canUngroup = isIdentityGroup,
  } = props;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const dragRef = useRef<DragSession | null>(null);

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

  const resolveDropHint = useCallback(
    (clientX: number, clientY: number): DropHint | null => {
      const session = dragRef.current;
      if (!session?.active) return null;
      const hoverEl = document
        .elementFromPoint(clientX, clientY)
        ?.closest("[data-layer-row]") as HTMLElement | null;
      const hoverId = hoverEl?.dataset.layerId;
      if (!hoverId || hoverId === session.layerId) return null;
      if (!session.siblingIds.has(hoverId)) return null;
      const rect = hoverEl.getBoundingClientRect();
      const edge: "before" | "after" =
        clientY < rect.top + rect.height / 2 ? "before" : "after";
      return { targetId: hoverId, edge };
    },
    [],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, commit: boolean) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const hint =
        commit && session.active
          ? resolveDropHint(event.clientX, event.clientY)
          : null;
      const suppress = session.suppressClick;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      dragRef.current = null;
      setDraggingId(null);
      setDropHint(null);
      if (hint) onReorder(session.layerId, hint.targetId, hint.edge);
      else if (!suppress) onSelect(session.layerId);
    },
    [onReorder, onSelect, resolveDropHint],
  );

  const renderRow = (
    layer: MotionLayer,
    depth: number,
    siblings: readonly MotionLayer[],
  ) => {
    const children = childrenOf(layer);
    const nestedPaint = [...children].sort((a, b) => b.zIndex - a.zIndex);
    const isGroup = layer.type === "group" && children.length > 0;
    const isExpanded = expanded.has(layer.id);
    const isSelected = selected.has(layer.id);
    const locked = isLocked(layer.id);
    const isVisible =
      layer.type === "audio" ||
      !("opacity" in layer) ||
      (layer.opacity ?? 100) > 0;
    const name = props.resolveDisplayName?.(layer) ?? layer.id;
    const isRenaming = renamingId === layer.id;
    const isDragging = draggingId === layer.id;

    const handleRowPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || locked) return;
      if ((event.target as HTMLElement).closest("button")) return;

      dragRef.current = {
        layerId: layer.id,
        siblingIds: new Set(siblings.map((item) => item.id)),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        suppressClick: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleRowPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      if (!session.active) {
        const dx = event.clientX - session.startX;
        const dy = event.clientY - session.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        session.active = true;
        session.suppressClick = true;
        setDraggingId(session.layerId);
      }

      setDropHint(resolveDropHint(event.clientX, event.clientY));
    };

    const hintHere = dropHint?.targetId === layer.id;
    const showBefore = hintHere && dropHint?.edge === "before";
    const showAfter = hintHere && dropHint?.edge === "after";

    return (
      <div key={layer.id}>
        <div
          data-layer-row
          data-layer-id={layer.id}
          className={`relative group flex items-center gap-1.5 rounded px-1.5 py-1 text-[13px] leading-none touch-none ${
            isSelected || isDragging
              ? "bg-[var(--accent-soft)] text-[var(--fg-primary)]"
              : draggingId
                ? "text-[var(--fg-secondary)]"
                : "text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
          } ${locked && !isDragging ? "opacity-70" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (isGroup && onEnterGroup) onEnterGroup(layer.id);
            else setRenamingId(layer.id);
          }}
          onPointerDown={handleRowPointerDown}
          onPointerMove={handleRowPointerMove}
          onPointerUp={(event) => endDrag(event, true)}
          onPointerCancel={(event) => endDrag(event, false)}
        >
          {showBefore ? (
            <div
              className="pointer-events-none absolute top-0 right-1 left-1 z-10 h-px bg-[var(--accent)]"
              aria-hidden
            />
          ) : null}
          {showAfter ? (
            <div
              className="pointer-events-none absolute right-1 bottom-0 left-1 z-10 h-px bg-[var(--accent)]"
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            className={`flex w-3 shrink-0 items-center justify-center text-[var(--fg-muted)] ${
              isGroup ? "" : "invisible"
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
              className="w-full rounded bg-[var(--bg-editor)] px-1 text-[13px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]"
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

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className={`${
                isVisible
                  ? "text-[var(--fg-muted)]"
                  : "text-[var(--fg-disabled)]"
              } hover:text-[var(--fg-primary)]`}
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
              className={`hover:text-[var(--fg-primary)] ${
                locked ? "text-[var(--accent-text)]" : "text-[var(--fg-muted)]"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(layer.id, !locked);
              }}
              aria-label={locked ? "Unlock layer" : "Lock layer"}
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        </div>
        {isGroup && isExpanded ? (
          <div>
            {nestedPaint.map((child) =>
              renderRow(child, depth + 1, nestedPaint),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const selectedGroups = layers.filter(
    (l): l is GroupLayer => selected.has(l.id) && l.type === "group",
  );
  const ungroupEnabled =
    selectedGroups.length === 1 && canUngroup(selectedGroups[0]!);

  return (
    <div className="flex h-full cursor-default flex-col bg-[var(--bg-surface)] text-[var(--fg-secondary)] [&_button]:cursor-default">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          Layers
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!canGroup}
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              canGroup
                ? "bg-[var(--bg-hover)] text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
                : "text-[var(--fg-disabled)] opacity-50"
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
                ? "bg-[var(--bg-hover)] text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
                : "text-[var(--fg-disabled)] opacity-50"
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
        {layers.map((layer) => renderRow(layer, 0, layers))}
      </div>
    </div>
  );
}
