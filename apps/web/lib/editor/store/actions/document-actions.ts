import {
  commitProjectMutation,
  type HistoryPush,
} from "@/lib/editor/store/commit-document-mutation";
import { stageSizeForAspect, updateVariable } from "@motionvideo/editor-core";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type DocumentActions = Pick<
  EditorStoreActions,
  | "updateBrand"
  | "updateNodeText"
  | "updateNodePosition"
  | "updateNodeAnimation"
  | "setAspectRatio"
>;

export function createDocumentActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
  pushEntry: HistoryPush,
): DocumentActions {
  return {
    updateBrand: (patch) => {
      const project = get().project;
      if (!project) return;
      let variables = project.variables;
      if (patch.name !== undefined) {
        variables = updateVariable(
          { ...project, variables },
          "project.brandName",
          patch.name,
        );
      }
      if (patch.primaryColor !== undefined) {
        variables = updateVariable(
          { ...project, variables },
          "project.primaryColor",
          patch.primaryColor,
        );
      }
      commitProjectMutation(set, get, pushEntry, {
        nextProject: {
          ...project,
          metadata: {
            ...project.metadata,
            name: patch.name ?? project.metadata.name,
          },
          variables,
        },
        label: "update-brand",
      });
    },

    updateNodeText: (rootLayerId, layerId, text) => {
      get().dispatchPropertyCommand({
        type: "set-node-text",
        targets: [{ rootLayerId, layerId }],
        patch: { text },
      });
    },

    updateNodePosition: (rootLayerId, layerId, position) => {
      get().dispatchPropertyCommand({
        type: "set-node-transform",
        targets: [{ rootLayerId, layerId }],
        patch: {
          ...(position.x !== undefined ? { x: position.x } : {}),
          ...(position.y !== undefined ? { y: position.y } : {}),
        },
      });
    },

    updateNodeAnimation: () => {
      // V1: preset animation clips (`scene.clips`) no longer exist — node
      // animations now live in `timeline.clips` keyframes. No-op until the
      // keyframe editor lands (legacy action kept for API stability).
    },

    setAspectRatio: (aspectRatio) => {
      const project = get().project;
      if (!project) return;
      const size = stageSizeForAspect(aspectRatio);
      commitProjectMutation(set, get, pushEntry, {
        nextProject: {
          ...project,
          composition: {
            ...project.composition,
            width: size.width,
            height: size.height,
          },
        },
        label: "set-aspect-ratio",
      });
    },
  };
}
