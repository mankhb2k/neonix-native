"use client";

/**
 * GroupLayersPanel — host that wires the clipkit-style `LayersTree` + `Breadcrumbs`
 * to the editor store. Double-click a group → `enterGroup` (drill in); click a
 * breadcrumb → `navigateGroupDepth` (pop out). Mutations route to store group
 * actions operating on `project.layers`.
 *
 * Selection is the store's `EditorSelection` node variant (pure `layerId`),
 * shared with the stage + inspector.
 */

import { Breadcrumbs, LayersTree } from "@motionvideo/editor-react";
import { isIdentityGroup, type GroupLayer } from "@motionvideo/editor-core";
import { useGroupScope } from "@/lib/editor/store/selectors/group-scope";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useMemo } from "react";

export function GroupLayersPanel() {
  const scope = useGroupScope();
  const groupPath = useEditorStore((s) => s.groupPath);
  const selection = useEditorStore((s) => s.selection);
  const rootLayers = useEditorStore((s) => s.project?.layers);

  // Paint order = zIndex descending (front-most first).
  const layers = useMemo(
    () => [...scope.layers].sort((a, b) => b.zIndex - a.zIndex),
    [scope.layers],
  );

  const selectedIds = useMemo(
    () => (selection.kind === "node" ? [selection.layerId] : []),
    [selection],
  );

  const store = useEditorStore;

  return (
    <div className="flex h-full flex-col">
      <Breadcrumbs
        layers={rootLayers ?? []}
        groupPath={groupPath}
        onNavigate={(depth) => store.getState().navigateGroupDepth(depth)}
      />
      <div className="min-h-0 flex-1">
        <LayersTree
          layers={layers}
          selection={selectedIds}
          onSelect={(id) => store.getState().selectNode(id)}
          onRename={(id, name) => store.getState().renameLayer(id, name)}
          onToggleVisible={(id, visible) =>
            store.getState().toggleLayerVisible(id, visible)
          }
          onReorder={(movingId, targetId) =>
            store.getState().reorderLayers(movingId, targetId)
          }
          onGroup={(ids) => store.getState().groupSelectedLayers(ids)}
          onUngroup={(groupId) => store.getState().ungroupLayer(groupId)}
          onEnterGroup={(groupId) => store.getState().enterGroup(groupId)}
          canUngroup={(group: GroupLayer) => isIdentityGroup(group)}
        />
      </div>
    </div>
  );
}
