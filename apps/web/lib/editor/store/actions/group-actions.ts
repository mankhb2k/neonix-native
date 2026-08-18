/**
 * Group actions — group drill-down navigation + layer-tree mutations.
 *
 * Navigation mirrors clipkit: `enterGroup` pushes onto `groupPath` (double-click
 * a group in LayersTree) and `navigateGroupDepth` pops back out (breadcrumbs).
 *
 * Mutations (rename / visibility / reorder / group / ungroup) operate on the
 * CURRENT scope (`resolveGroupPath(project.layers, groupPath).layers`) and are
 * written back into the tree in place. They are protocol-correct against the V1
 * layers model and become live as soon as the document model is migrated to
 * `project.layers` (the legacy scene/track model is the pending Phase 2–5 work).
 */

import {
  documentFromStoreState,
  groupLayers,
  packRootLayersToTimeline,
  resolveGroupPath,
  selectionNone,
  uid,
  ungroupLayers,
  type HistoryEntry,
} from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type GroupActions = Pick<
  EditorStoreActions,
  | "enterGroup"
  | "navigateGroupDepth"
  | "renameLayer"
  | "toggleLayerVisible"
  | "reorderLayers"
  | "groupSelectedLayers"
  | "ungroupLayer"
>;

/** Push a history entry (owner updates `historyState` + canUndo/canRedo). */
export type GroupHistoryPush = (entry: HistoryEntry) => void;

/** Recursively map a single layer by id (handles nested group children). */
function mapLayerById(
  layers: MotionLayer[],
  id: string,
  fn: (layer: MotionLayer) => MotionLayer,
): MotionLayer[] {
  return layers.map((layer) => {
    if (layer.id === id) return fn(layer);
    if (layer.type === "group" && Array.isArray(layer.children)) {
      return {
        ...layer,
        children: mapLayerById(layer.children, id, fn),
      } as MotionLayer;
    }
    return layer;
  });
}

/** Apply `fn` to the array at the end of `groupPath`, rebuilding the tree. */
function withScopedLayers(
  root: MotionLayer[],
  groupPath: readonly string[],
  fn: (scoped: MotionLayer[]) => MotionLayer[],
): MotionLayer[] {
  if (groupPath.length === 0) return fn(root);
  const [head, ...rest] = groupPath;
  return root.map((layer) => {
    if (layer.id !== head || layer.type !== "group") return layer;
    return {
      ...layer,
      children: withScopedLayers(layer.children, rest, fn),
    } as MotionLayer;
  });
}

export function createGroupActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
  pushEntry: GroupHistoryPush,
): GroupActions {
  /** Commit a `project.layers` mutation with a single undoable history entry. */
  const commit = (
    beforeProject: NonNullable<ReturnType<EditorStoreGet>["project"]>,
    nextLayers: MotionLayer[],
    label: string,
  ) => {
    const before = documentFromStoreState(get());
    if (!before) return;
    const nextProject = { ...beforeProject, layers: nextLayers };
    const packed =
      get().groupPath.length === 0
        ? packRootLayersToTimeline(nextProject)
        : null;
    set({
      project: nextProject,
      dirtyRevision: get().dirtyRevision + 1,
      ...(packed
        ? { timelineClips: packed.clips, timelineLanes: packed.lanes }
        : {}),
    });
    const after = documentFromStoreState({
      ...get(),
      project: nextProject,
    });
    if (!after) return;
    pushEntry({
      id: `hist_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      label,
      before,
      after,
      beforeSelection: get().selection,
      afterSelection: get().selection,
    });
  };

  return {
    enterGroup: (groupId) => {
      const state = get();
      if (!state.project) return;
      const scoped = resolveGroupPath(state.project.layers, state.groupPath);
      const group = scoped.layers.find(
        (l) => l.id === groupId && l.type === "group",
      );
      if (!group) return;
      set({
        groupPath: [...state.groupPath, groupId],
        selection: selectionNone(),
      });
    },

    navigateGroupDepth: (depth) => {
      const next = get().groupPath.slice(0, Math.max(0, depth));
      set({ groupPath: next, selection: selectionNone() });
    },

    renameLayer: (layerId, name) => {
      const project = get().project;
      if (!project) return;
      const next = mapLayerById(project.layers, layerId, (layer) => ({
        ...layer,
        name,
      }));
      commit(project, next, "rename-layer");
    },

    toggleLayerVisible: (layerId, visible) => {
      const project = get().project;
      if (!project) return;
      const next = mapLayerById(project.layers, layerId, (layer) => ({
        ...layer,
        ...("appearance" in layer
          ? { appearance: { ...layer.appearance, visible } }
          : {}),
      }));
      commit(project, next, "toggle-layer-visible");
    },

    reorderLayers: (movingId, targetId) => {
      const project = get().project;
      if (!project || movingId === targetId) return;
      let movingZ = 0;
      let targetZ = 0;
      let found = 0;
      const scan = (layers: MotionLayer[]) => {
        for (const layer of layers) {
          if (layer.id === movingId) {
            movingZ = layer.zIndex;
            found += 1;
          }
          if (layer.id === targetId) {
            targetZ = layer.zIndex;
            found += 1;
          }
          if (layer.type === "group" && Array.isArray(layer.children)) {
            scan(layer.children);
          }
        }
      };
      scan(project.layers);
      if (found < 2) return;
      const next = mapLayerById(project.layers, movingId, (layer) => ({
        ...layer,
        zIndex: targetZ,
      }));
      const finalLayers = mapLayerById(next, targetId, (layer) => ({
        ...layer,
        zIndex: movingZ,
      }));
      commit(project, finalLayers, "reorder-layers");
    },

    groupSelectedLayers: (ids) => {
      const project = get().project;
      if (!project) return;
      const next = withScopedLayers(
        project.layers,
        get().groupPath,
        (scoped) => groupLayers(scoped, ids, uid("group"))?.layers ?? scoped,
      );
      commit(project, next, "group-layers");
    },

    ungroupLayer: (groupId) => {
      const project = get().project;
      if (!project) return;
      const next = withScopedLayers(
        project.layers,
        get().groupPath,
        (scoped) => ungroupLayers(scoped, groupId)?.layers ?? scoped,
      );
      commit(project, next, "ungroup-layers");
    },
  };
}
