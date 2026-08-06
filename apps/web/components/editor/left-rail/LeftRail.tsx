"use client";

import { Panel, Tabs } from "@/components/ui";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import {
  selectionNone,
  selectionNode,
} from "@/lib/editor/model/editor-selection";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { FileAudio, ImagePlus, Upload } from "lucide-react";

function LayerTree() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const preview = useMemo(
    () => (project ? resolvePreviewProject(project) : null),
    [project],
  );
  const scene =
    preview?.project.scenes.find((s) => s.id === preview.sceneId) ??
    preview?.project.scenes[0];
  const nodes = scene?.nodes ?? [];

  return (
    <div className="space-y-1 p-2" data-testid="layer-tree">
      {nodes.length === 0 ? (
        <p className="p-2 text-body leading-normal text-[var(--fg-muted)]">
          Chưa có layer.
        </p>
      ) : (
        nodes.map((node) => {
          const selected =
            selection.kind === "node" &&
            selection.nodeId === node.id &&
            selection.sceneId === (scene?.id ?? "");
          return (
            <button
              key={node.id}
              type="button"
              data-testid={`layer-row-${node.id}`}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] border-0",
                selected
                  ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "bg-transparent text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]",
              )}
              onClick={() => {
                if (!scene) return;
                useEditorStore.setState({
                  selection: selectionNode(scene.id, node.id),
                });
              }}
            >
              <span className="truncate">{node.name ?? node.id}</span>
              <span className="text-[10px] uppercase text-[var(--fg-muted)]">
                {node.type}
              </span>
            </button>
          );
        })
      )}
      {selection.kind === "node" ? (
        <button
          type="button"
          className="mt-2 w-full cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
          onClick={() =>
            useEditorStore.setState({ selection: selectionNone() })
          }
        >
          Clear selection
        </button>
      ) : null}
    </div>
  );
}

function AssetsPanel() {
  const project = useEditorStore((s) => s.project);
  const assets = project?.assets ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assets-panel">
      <div className="shrink-0 space-y-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
          disabled
          title="Upload sẽ nối asset ingest API"
        >
          <Upload size={14} />
          Upload media
        </button>
        <p className="text-[10px] leading-snug text-[var(--fg-muted)]">
          Ảnh, SVG, audio (mp3/wav/aac). Kéo vào stage hoặc timeline sau khi
          upload.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-8 text-center">
            <div className="flex items-center gap-2 text-[var(--fg-disabled)]">
              <ImagePlus size={20} />
              <FileAudio size={20} />
            </div>
            <p className="text-[12px] text-[var(--fg-muted)]">
              Chưa có file. Upload ảnh, SVG hoặc audio để dùng trong video.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2"
              >
                <p className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
                  {asset.id}
                </p>
                <p className="truncate text-[10px] text-[var(--fg-muted)]">
                  {asset.assetType} · {asset.uri}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LeftRail() {
  return (
    <aside className="min-h-0 border-r-2 border-[var(--border-subtle)] [grid-area:left]">
      <Panel
        bodyClassName="!p-0"
        className="h-full rounded-none border-0"
      >
        <Tabs
          defaultValue="layers"
          items={[
            {
              id: "layers",
              label: "Layers",
              content: <LayerTree />,
            },
            {
              id: "assets",
              label: "Assets",
              content: <AssetsPanel />,
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
