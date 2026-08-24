"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { Panel, Tabs } from "@/components/ui";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { useMemo } from "react";

type V2Layer = MotionProtocolV2["layers"][number];

type DisplayLayer = {
  layer: V2Layer;
  depth: number;
};

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

function layerKindLabel(layer: V2Layer): string {
  if (layer.type === "text") return "Text";
  if (layer.type === "shape") return layer.payload.shape;
  return layer.type;
}

/** Existing sidebar chrome, migrated in-place to the Protocol V2 document. */
export function Sidebar() {
  const { document, selectedLayerIds, setSelectedLayerIds } = useEditorSurface();
  const displayLayers = useMemo(
    () => buildLayerTree(document.layers),
    [document.layers],
  );

  return (
    <aside className="editor-panel overflow-hidden [grid-area:sidebar]">
      <Panel
        bodyClassName="!p-0"
        className="h-full rounded-none border-0 bg-transparent shadow-none"
      >
        <Tabs
          defaultValue="layers"
          items={[
            {
              id: "layers",
              label: "Layers",
              content: (
                <div className="h-full overflow-auto p-2" data-testid="layers-panel">
                  <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                    <span>Protocol V2</span>
                    <span>{displayLayers.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {displayLayers.map(({ layer, depth }) => {
                      const selected = selectedLayerIds.includes(layer.id);
                      return (
                        <li key={layer.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedLayerIds([layer.id])}
                            className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"}`}
                            style={{ paddingLeft: `${10 + depth * 14}px` }}
                            data-layer-id={layer.id}
                            data-layer-order={layer.order}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium">
                                {layer.id}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] opacity-70">
                                {layerKindLabel(layer)} · {layer.timing.start.toFixed(2)}s–{(layer.timing.start + layer.timing.duration).toFixed(2)}s
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-[10px] opacity-70">
                              z{layer.order}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            },
            {
              id: "assets",
              label: "Assets",
              content: (
                <div className="h-full overflow-auto p-3" data-testid="assets-panel">
                  {document.assets.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-6 text-center text-[12px] text-[var(--fg-muted)]">
                      Chưa có asset.
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {document.assets.map((asset) => (
                        <li
                          key={asset.id}
                          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2"
                        >
                          <p className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
                            {asset.id}
                          </p>
                          <p className="truncate text-[10px] text-[var(--fg-muted)]">
                            {asset.kind} · {asset.uri}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            },
            {
              id: "json",
              label: "JSON",
              content: (
                <pre className="h-full overflow-auto p-3 text-[10px] leading-relaxed text-[var(--fg-secondary)]">
                  {JSON.stringify(document, null, 2)}
                </pre>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
