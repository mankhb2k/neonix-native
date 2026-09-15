"use client";

import {
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  FileVideo,
  Folder,
  Image as ImageIcon,
  Shapes,
  Spline,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type PreviewLayer = MotionProtocolV2["layers"][number];

type PreviewLayerSidebarProps = {
  project: MotionProtocolV2;
  selectedLayerId: string | null;
  copiedLayerId: string | null;
  className?: string;
  onSelect: (layerId: string) => void;
  onCopyId: (layerId: string) => void;
};

function LayerIcon({ layer }: { layer: PreviewLayer }) {
  if (layer.type === "group") return <Folder size={14} strokeWidth={1.8} />;
  if (layer.type === "text") return <Type size={14} strokeWidth={1.8} />;
  if (layer.type === "shape") return <Shapes size={14} strokeWidth={1.8} />;
  if (layer.type === "image") return <ImageIcon size={14} strokeWidth={1.8} />;
  if (layer.type === "video") return <FileVideo size={14} strokeWidth={1.8} />;
  if (layer.type === "path") return <Spline size={14} strokeWidth={1.8} />;
  return <Circle size={13} strokeWidth={1.8} />;
}

function formatSeconds(milliseconds: number): string {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(2)}s`;
}

function LayerTree({
  layer,
  depth,
  childrenByParent,
  expandedIds,
  selectedLayerId,
  onToggle,
  onSelect,
}: {
  layer: PreviewLayer;
  depth: number;
  childrenByParent: ReadonlyMap<string | null, readonly PreviewLayer[]>;
  expandedIds: ReadonlySet<string>;
  selectedLayerId: string | null;
  onToggle: (layerId: string) => void;
  onSelect: (layerId: string) => void;
}) {
  const children = childrenByParent.get(layer.id) ?? [];
  const isGroup = layer.type === "group";
  const isExpanded = expandedIds.has(layer.id);
  const isSelected = selectedLayerId === layer.id;

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isGroup ? isExpanded : undefined}
        className={`flex min-w-0 items-center gap-1 rounded-md border transition-colors ${isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-transparent text-[var(--fg-primary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        data-layer-id={layer.id}
      >
        <button
          type="button"
          tabIndex={isGroup ? 0 : -1}
          aria-label={isGroup ? `${isExpanded ? "Collapse" : "Expand"} ${layer.id}` : undefined}
          className="flex size-6 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
          onClick={() => {
            if (isGroup) onToggle(layer.id);
          }}
        >
          {isGroup ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"
          onClick={() => onSelect(layer.id)}
        >
          <span className="shrink-0 text-[var(--fg-muted)]"><LayerIcon layer={layer} /></span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{layer.id}</span>
          <span className="shrink-0 font-mono text-[10px] uppercase text-[var(--fg-muted)]">{layer.type}</span>
        </button>
      </div>
      {isGroup && isExpanded && children.length > 0 ? (
        <ul role="group" className="space-y-1 pt-1">
          {children.map((child) => (
            <LayerTree
              key={child.id}
              layer={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expandedIds={expandedIds}
              selectedLayerId={selectedLayerId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PreviewLayerSidebar({
  project,
  selectedLayerId,
  copiedLayerId,
  className,
  onSelect,
  onCopyId,
}: PreviewLayerSidebarProps) {
  const childrenByParent = useMemo(() => {
    const children = new Map<string | null, PreviewLayer[]>();
    for (const layer of project.layers) {
      const siblings = children.get(layer.parentLayerId) ?? [];
      siblings.push(layer);
      children.set(layer.parentLayerId, siblings);
    }
    for (const siblings of children.values()) {
      siblings.sort((left, right) => right.order - left.order);
    }
    return children;
  }, [project.layers]);
  const groupIds = useMemo(
    () => project.layers.filter((layer) => layer.type === "group").map((layer) => layer.id),
    [project.layers],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(groupIds));
  useEffect(() => setExpandedIds(new Set(groupIds)), [groupIds]);

  const selectedLayer = selectedLayerId
    ? project.layers.find((layer) => layer.id === selectedLayerId) ?? null
    : null;
  const parentLayer = selectedLayer?.parentLayerId
    ? project.layers.find((layer) => layer.id === selectedLayer.parentLayerId)
    : null;

  return (
    <aside className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_8px_24px_rgba(0,0,0,.06)] ${className ?? ""}`} data-testid="preview-layer-sidebar">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-primary)]">Layers</p>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">Read-only structure</p>
        </div>
        <span className="font-mono text-[10px] text-[var(--fg-muted)]">{project.layers.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin]">
        <ul role="tree" aria-label="Preview layers" className="space-y-1">
          {(childrenByParent.get(null) ?? []).map((layer) => (
            <LayerTree
              key={layer.id}
              layer={layer}
              depth={0}
              childrenByParent={childrenByParent}
              expandedIds={expandedIds}
              selectedLayerId={selectedLayerId}
              onToggle={(layerId) => setExpandedIds((current) => {
                const next = new Set(current);
                if (next.has(layerId)) next.delete(layerId);
                else next.add(layerId);
                return next;
              })}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </div>

      <div className="border-t border-[var(--border-subtle)] p-4" data-testid="preview-layer-details">
        {selectedLayer ? (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]">Selected object</p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--fg-primary)]">{selectedLayer.id}</p>
              </div>
              <button
                type="button"
                aria-label={`Copy ${selectedLayer.id}`}
                title="Copy object ID"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                onClick={() => onCopyId(selectedLayer.id)}
              >
                {copiedLayerId === selectedLayer.id ? <span className="text-[10px] font-semibold">OK</span> : <Copy size={13} />}
              </button>
            </div>
            <dl className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-3"><dt className="text-[var(--fg-muted)]">Type</dt><dd className="font-mono text-[var(--fg-secondary)]">{selectedLayer.type}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-[var(--fg-muted)]">Parent</dt><dd className="max-w-[150px] truncate font-mono text-right text-[var(--fg-secondary)]">{parentLayer?.id ?? "Root"}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-[var(--fg-muted)]">Timing</dt><dd className="font-mono text-[var(--fg-secondary)]">{formatSeconds(selectedLayer.timing.start)} → {formatSeconds(selectedLayer.timing.start + selectedLayer.timing.duration)}</dd></div>
            </dl>
          </>
        ) : (
          <p className="text-[11px] leading-5 text-[var(--fg-muted)]">Select an object on the canvas or from the layer tree to inspect its read-only metadata.</p>
        )}
      </div>
    </aside>
  );
}
