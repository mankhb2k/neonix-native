import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Layers,
  ArrowLeftToLine,
  Music,
  Film,
  PanelRightOpen,
} from "lucide-react";
import {
  isSceneClip,
  selectionClips,
  selectionNode,
  type DocumentPropertyCommand,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { useEditorUiSession } from "../../session/editor-ui-session";
import {
  buildLayerTree,
  collectExpandableIds,
  flattenVisibleTree,
  reorderSiblingAndCollectDfs,
  resolveSidebarSiblingInsert,
} from "../../timeline/layer-mode/build-layer-tree";
import { LayerTreeRowView } from "./LayerTreeRow";

type Props = {
  project: MotionProject | null;
  lanes: TimelineLane[];
  clips: TimelineClip[];
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
};

function clipIcon(clip: TimelineClip) {
  if (clip.kind === "audio") {
    return <Music size={14} className="shrink-0 text-sky-400" />;
  }
  return <Film size={14} className="shrink-0 text-sky-300" />;
}

function ListHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-zinc-100">
        <Layers size={14} className="shrink-0 text-sky-400" />
        <span className="truncate">{title}</span>
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function clipRowClass(selected: boolean) {
  return [
    "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
    selected
      ? "border-sky-500/40 bg-sky-950/35"
      : "border-transparent bg-[#1a1a1e] hover:border-zinc-700/80 hover:bg-[#222228]",
  ].join(" ");
}

export function LayersPanel({
  project,
  clips,
  selection,
  onSelect,
  onExecuteProperty,
}: Props) {
  const timelineMode = useEditorUiSession((s) => s.timelineMode);
  const activeContainerClipId = useEditorUiSession(
    (s) => s.activeContainerClipId,
  );
  const enterLayerMode = useEditorUiSession((s) => s.enterLayerMode);
  const exitLayerMode = useEditorUiSession((s) => s.exitLayerMode);
  const inLayerMode = timelineMode === "layer";

  const selectedClipId =
    activeContainerClipId ??
    (selection.kind === "clips" && selection.ids.length > 0
      ? selection.primaryId
      : selection.kind === "node"
        ? (clips.find(
            (c) => c.kind === "scene" && c.sceneId === selection.sceneId,
          )?.id ?? null)
        : null);

  const activeClip = clips.find((c) => c.id === selectedClipId);
  const showLayerList =
    inLayerMode || (activeClip != null && isSceneClip(activeClip));

  const scene =
    activeClip && isSceneClip(activeClip)
      ? (project?.scenes.find((s) => s.id === activeClip.sceneId) ?? null)
      : null;
  const sceneId = scene?.id ?? null;

  const tree = useMemo(() => buildLayerTree(scene), [scene]);
  const treeNodeCount = useMemo(() => {
    let n = 0;
    const walk = (layers: typeof tree) => {
      for (const node of layers) {
        n += 1;
        walk(node.children);
      }
    };
    walk(tree);
    return n;
  }, [tree]);

  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, string[]>
  >({});
  const [lockedIds, setLockedIds] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    hoverId: string;
    edge: "before" | "after";
  } | null>(null);

  useEffect(() => {
    if (!sceneId) return;
    setExpandedByScene((prev) => {
      if (prev[sceneId]) return prev;
      return { ...prev, [sceneId]: collectExpandableIds(tree) };
    });
  }, [sceneId, tree]);

  const expandedIds = useMemo(() => {
    if (!sceneId) return new Set<string>();
    return new Set(expandedByScene[sceneId] ?? collectExpandableIds(tree));
  }, [expandedByScene, sceneId, tree]);

  const rows = useMemo(
    () => flattenVisibleTree(tree, expandedIds),
    [tree, expandedIds],
  );

  const toggleExpand = (layerId: string) => {
    if (!sceneId) return;
    setExpandedByScene((prev) => {
      const current = new Set(prev[sceneId] ?? collectExpandableIds(tree));
      if (current.has(layerId)) current.delete(layerId);
      else current.add(layerId);
      return { ...prev, [sceneId]: [...current] };
    });
  };

  const toggleLock = (layerId: string) => {
    setLockedIds((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleVisible = (layerId: string, currentlyVisible: boolean) => {
    if (!sceneId || !onExecuteProperty) return;
    onExecuteProperty({
      command: {
        type: "set-node-metadata",
        targets: [{ rootLayerId: sceneId, layerId }],
        patch: { visible: !currentlyVisible },
      },
      label: currentlyVisible ? "Hide layer" : "Show layer",
      coalesceKey: `node-visible:${sceneId}:${layerId}`,
    });
  };

  const commitSiblingReorder = (
    movingId: string,
    insertBeforeSiblingId: string | null,
  ) => {
    if (!sceneId || !onExecuteProperty) return;
    const nextIds = reorderSiblingAndCollectDfs(
      tree,
      movingId,
      insertBeforeSiblingId,
    );
    if (!nextIds) return;
    onExecuteProperty({
      command: {
        type: "reorder-scene-layers",
        rootLayerId: sceneId,
        layerIds: nextIds,
      },
      label: "Reorder layers",
      coalesceKey: `node-reorder:${sceneId}`,
    });
  };

  const clearDrag = () => {
    setDragId(null);
    setDropHint(null);
  };

  if (showLayerList && activeClip && isSceneClip(activeClip)) {
    const selectedNodeId =
      selection.kind === "node" && selection.sceneId === activeClip.sceneId
        ? selection.layerId
        : null;

    return (
      <aside
        className="flex h-full flex-col gap-2 bg-[var(--bg-panel)] p-2"
        data-testid="layers-panel-layer-list"
      >
        <ListHeader
          title={`Danh sách Layer (${treeNodeCount})`}
          action={
            inLayerMode ? (
              <button
                type="button"
                onClick={exitLayerMode}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-sky-500/40 hover:bg-zinc-800 hover:text-sky-300"
                title="Track Mode"
              >
                <ArrowLeftToLine size={12} />
                Track Mode
              </button>
            ) : (
              <button
                type="button"
                onClick={() => enterLayerMode(activeClip.id, clips)}
                className="inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 transition-colors hover:border-sky-400/50 hover:bg-sky-900/50"
                title="Vào Layer Mode"
                data-testid="enter-layer-mode"
              >
                <PanelRightOpen size={12} />
                Layer Mode
              </button>
            )
          }
        />

        <p className="truncate px-1 text-[10px] text-zinc-500">
          Clip: {activeClip.name || activeClip.id}
        </p>

        {rows.length === 0 ? (
          <p className="px-1 text-[11px] text-zinc-500">
            Scene chưa có layer nào.
          </p>
        ) : (
          <div
            role="tree"
            aria-label="Scene layers"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            {rows.map((row) => {
              const dropEdge =
                dropHint?.hoverId === row.id ? dropHint.edge : null;
              return (
                <LayerTreeRowView
                  key={row.id}
                  row={row}
                  selected={selectedNodeId === row.id}
                  expanded={expandedIds.has(row.id)}
                  locked={Boolean(lockedIds[row.id])}
                  dragging={dragId === row.id}
                  dropEdge={dropEdge}
                  onSelect={() =>
                    onSelect(selectionNode(activeClip.sceneId, row.id))
                  }
                  onToggleExpand={() => toggleExpand(row.id)}
                  onToggleLock={() => toggleLock(row.id)}
                  onToggleVisible={() => toggleVisible(row.id, row.visible)}
                  onDragStart={(e) => {
                    if (lockedIds[row.id]) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/layer-node-id", row.id);
                    setDragId(row.id);
                    onSelect(selectionNode(activeClip.sceneId, row.id));
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    const edge =
                      e.nativeEvent.offsetY < e.currentTarget.clientHeight / 2
                        ? "before"
                        : "after";
                    const resolved = resolveSidebarSiblingInsert(
                      rows,
                      dragId,
                      row.id,
                      edge,
                    );
                    if (!resolved) {
                      setDropHint(null);
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropHint({ hoverId: row.id, edge });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const movingId =
                      e.dataTransfer.getData("text/layer-node-id") || dragId;
                    if (!movingId || !dropHint) {
                      clearDrag();
                      return;
                    }
                    const edge =
                      dropHint.hoverId === row.id
                        ? dropHint.edge
                        : e.nativeEvent.offsetY <
                            e.currentTarget.clientHeight / 2
                          ? "before"
                          : "after";
                    const resolved = resolveSidebarSiblingInsert(
                      rows,
                      movingId,
                      row.id,
                      edge,
                    );
                    clearDrag();
                    if (!resolved) return;
                    commitSiblingReorder(
                      movingId,
                      resolved.insertBeforeSiblingId,
                    );
                  }}
                  onDragEnd={clearDrag}
                />
              );
            })}
          </div>
        )}

        {!inLayerMode ? (
          <button
            type="button"
            onClick={() => onSelect(selectionClips([]))}
            className="mt-auto px-1 text-left text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← Tất cả clips
          </button>
        ) : null}
      </aside>
    );
  }

  const selectedSceneClip =
    selection.kind === "clips"
      ? clips.find((c) => c.id === selection.primaryId && isSceneClip(c))
      : undefined;
  const canEnterLayer = selectedSceneClip != null;

  return (
    <aside
      className="flex h-full flex-col gap-3 bg-[var(--bg-panel)] p-3"
      data-testid="layers-panel-clip-list"
    >
      <ListHeader
        title={`Danh sách Clips (${clips.length})`}
        action={
          <button
            type="button"
            disabled={!canEnterLayer}
            onClick={() => {
              if (!selectedSceneClip) return;
              enterLayerMode(selectedSceneClip.id, clips);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 transition-colors hover:border-sky-400/50 hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
            title={
              canEnterLayer
                ? "Vào Layer Mode với clip đang chọn"
                : "Chọn một scene clip để vào Layer Mode"
            }
            data-testid="enter-layer-mode"
          >
            <PanelRightOpen size={12} />
            Layer Mode
          </button>
        }
      />

      {clips.length === 0 ? (
        <p className="px-0.5 text-[11px] text-zinc-500">
          Chưa có clip nào trong dự án.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {clips.map((clip) => {
            const isSelected =
              selection.kind === "clips" && selection.primaryId === clip.id;
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelect(selectionClips([clip.id]))}
                onDoubleClick={() => enterLayerMode(clip.id, clips)}
                className={clipRowClass(isSelected)}
                data-testid="clip-list-row"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {clipIcon(clip)}
                  <span className="truncate text-[12px] font-medium text-zinc-100">
                    {clip.name || clip.id}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                  {clip.duration.toFixed(1)}s
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
