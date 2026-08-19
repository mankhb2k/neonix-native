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

import { useMemo } from "react";

import { Breadcrumbs } from "@/components/editor/frame/Breadcrumbs";
import { LayersTree } from "@/components/editor/panels/LayersTree";
import { useGroupScope } from "@/hooks/editor/use-group-scope";
import { useEditorStore } from "@/lib/editor/editor-store";
import { rootLayerIdOf, isIdentityGroup, type GroupLayer } from "@motionvideo/editor-core";
import { isElementLocked } from "@/lib/editor/authoring/web-project-envelope";

export function GroupLayersPanel() {
  const scope = useGroupScope();
  const groupPath = useEditorStore((s) => s.groupPath);
  const selection = useEditorStore((s) => s.selection);
  const rootLayers = useEditorStore((s) => s.project?.layers);
  const project = useEditorStore((s) => s.project);
  const envelope = useEditorStore((s) => s.envelope);

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
          resolveDisplayName={(layer) =>
            envelope?.authoring.layerDisplayNames?.[layer.id] ?? layer.id
          }
          onSelect={(id) => store.getState().selectNode(id)}
          onRename={(id, name) => store.getState().renameLayer(id, name)}
          onToggleVisible={(id, visible) =>
            store.getState().toggleLayerVisible(id, visible)
          }
          isLocked={(id) => {
            if (!project || !envelope) return false;
            const rootId = rootLayerIdOf(project, id) ?? id;
            return isElementLocked(envelope, rootId, id);
          }}
          onToggleLock={(id, locked) => {
            if (!project) return;
            const rootId = rootLayerIdOf(project, id) ?? id;
            store.getState().setElementLocked(rootId, id, locked);
          }}
          onReorder={(movingId, targetId, edge) =>
            store.getState().reorderLayers(movingId, targetId, edge)
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
