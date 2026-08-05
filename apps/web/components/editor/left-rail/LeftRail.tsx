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

function ScenesList() {
  const project = useEditorStore((s) => s.project);
  const preview = useMemo(
    () => (project ? resolvePreviewProject(project) : null),
    [project],
  );
  const scenes = preview?.project.scenes ?? [];

  return (
    <div className="space-y-2 p-3">
      {preview?.usingDemo ? (
        <p className="editor-placeholder text-[11px]">
          Đang xem demo fixture (project trống).
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {scenes.map((scene, index) => (
          <li
            key={scene.id}
            className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-2.5 py-2 text-[12px] text-[var(--fg-secondary)]"
          >
            Scene {index + 1} — {scene.name ?? scene.id}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        <p className="editor-placeholder p-2">Chưa có layer.</p>
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
                "flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[12px] border-0",
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
          className="mt-2 w-full cursor-pointer rounded-[var(--radius-sm)] px-2 py-1.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] border-0 bg-transparent"
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

export function LeftRail() {
  return (
    <aside className="editor-area-left border-r border-[var(--border-subtle)]">
      <Panel
        title="Library"
        bodyClassName="!p-0"
        className="h-full rounded-none border-0"
      >
        <Tabs
          defaultValue="layers"
          items={[
            {
              id: "scenes",
              label: "Scenes",
              content: <ScenesList />,
            },
            {
              id: "layers",
              label: "Layers",
              content: <LayerTree />,
            },
            {
              id: "assets",
              label: "Assets",
              content: (
                <div className="p-3">
                  <p className="editor-placeholder">
                    Upload / library sẽ nối asset pipeline (PR8).
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
