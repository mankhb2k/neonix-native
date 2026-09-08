"use client";

import {
  Eye,
  EyeOff,
  File as FileIcon,
  FileVideo,
  Folder,
  Image as ImageIcon,
  Lock,
  Shapes,
  Spline,
  Type,
  Unlock,
} from "lucide-react";
import { useMemo, type SyntheticEvent } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
  useEditorVisibility,
} from "@/hooks/editor/use-editor-store";
import { updateKeyboardSelection } from "@motionvideo/editor-core";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type DisplayLayer = { layer: V2Layer; depth: number };

function buildLayerTree(layers: readonly V2Layer[]): DisplayLayer[] {
  const children = new Map<string | null, V2Layer[]>();
  for (const layer of layers) {
    const list = children.get(layer.parentLayerId) ?? [];
    list.push(layer);
    children.set(layer.parentLayerId, list);
  }
  for (const list of children.values()) {
    list.sort((left, right) => right.order - left.order);
  }
  const result: DisplayLayer[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const layer of children.get(parentId) ?? []) {
      result.push({ layer, depth });
      if (layer.type === "group") visit(layer.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

function LayerIcon({ layer }: { layer: V2Layer }) {
  if (layer.type === "text") return <Type size={14} strokeWidth={1.8} />;
  if (layer.type === "shape") return <Shapes size={14} strokeWidth={1.8} />;
  if (layer.type === "image") return <ImageIcon size={14} strokeWidth={1.8} />;
  if (layer.type === "video") return <FileVideo size={14} strokeWidth={1.8} />;
  if (layer.type === "path") return <Spline size={14} strokeWidth={1.8} />;
  if (layer.type === "group") return <Folder size={14} strokeWidth={1.8} />;
  return <FileIcon size={14} strokeWidth={1.8} />;
}

export function LayersPanel() {
  const {
    setSelectedLayerIds,
    toggleLayerVisibility,
    toggleLayerLock,
  } = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const hiddenLayerIds = useEditorVisibility();
  const lockedLayerIds = useEditorLocks();
  const displayLayers = useMemo(
    () => buildLayerTree(document.layers),
    [document.layers],
  );

  return (
    <div className="h-full overflow-auto p-2" data-testid="layers-panel">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
        <span>Root Layers</span>
        <span>{displayLayers.length}</span>
      </div>
      <ul className="space-y-1">
        {displayLayers.map(({ layer, depth }) => {
          const selected = selectedLayerIds.includes(layer.id);
          const hidden = hiddenLayerIds.includes(layer.id);
          const locked = lockedLayerIds.includes(layer.id);
          const stopLayerSelection = (event: SyntheticEvent) => {
            event.preventDefault();
            event.stopPropagation();
          };
          return (
            <li key={layer.id}>
              <button
                type="button"
                onClick={(event) =>
                  setSelectedLayerIds((previous) =>
                    updateKeyboardSelection(
                      displayLayers.map((entry) => entry.layer.id),
                      previous,
                      layer.id,
                      {
                        shiftKey: event.shiftKey,
                        additiveKey: event.metaKey || event.ctrlKey,
                      },
                    ),
                  )
                }
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"}`}
                style={{ paddingLeft: `${10 + depth * 14}px` }}
                data-layer-id={layer.id}
                data-layer-order={layer.order}
              >
                <LayerIcon layer={layer} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                  {layer.id}
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={hidden ? `Show ${layer.id}` : `Hide ${layer.id}`}
                    aria-pressed={hidden}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                    onPointerDown={(event) => {
                      stopLayerSelection(event);
                      toggleLayerVisibility(layer.id);
                    }}
                    onClick={stopLayerSelection}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      stopLayerSelection(event);
                      toggleLayerVisibility(layer.id);
                    }}
                  >
                    {hidden ? (
                      <EyeOff size={14} strokeWidth={1.8} />
                    ) : (
                      <Eye size={14} strokeWidth={1.8} />
                    )}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={locked ? `Unlock ${layer.id}` : `Lock ${layer.id}`}
                    aria-pressed={locked}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                    onPointerDown={(event) => {
                      stopLayerSelection(event);
                      toggleLayerLock(layer.id);
                    }}
                    onClick={stopLayerSelection}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      stopLayerSelection(event);
                      toggleLayerLock(layer.id);
                    }}
                  >
                    {locked ? (
                      <Lock size={14} strokeWidth={1.8} />
                    ) : (
                      <Unlock size={14} strokeWidth={1.8} />
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
