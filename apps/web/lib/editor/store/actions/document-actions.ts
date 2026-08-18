import {
  mapNode,
  uid,
  updateVariable,
  stageSizeForAspect,
  syncProjectProtocolContract,
} from "@motionvideo/editor-core";
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
      set({
        project: syncProjectProtocolContract({
          ...project,
          metadata: {
            ...project.metadata,
            name: patch.name ?? project.metadata.name,
          },
          variables,
        }),
      });
    },

    updateNodeText: (sceneId, layerId, text) => {
      const project = get().project;
      if (!project) return;
      set({
        project: syncProjectProtocolContract(
          mapNode(project, sceneId, layerId, (node) =>
            node.type === "text"
              ? { ...node, payload: { ...node.payload, text } }
              : node,
          ),
        ),
      });
    },

    updateNodePosition: (sceneId, layerId, position) => {
      const project = get().project;
      if (!project) return;
      set({
        project: syncProjectProtocolContract(
          mapNode(project, sceneId, layerId, (node) => {
            if (!("transform" in node) || !node.transform) return node;
            return {
              ...node,
              transform: {
                ...node.transform,
                translate: {
                  ...node.transform.translate,
                  x: position.x ?? node.transform.translate.x,
                  y: position.y ?? node.transform.translate.y,
                },
              },
            };
          }),
        ),
      });
    },

    updateNodeAnimation: (_sceneId, _layerId, _patch) => {
      // V1: preset animation clips (`scene.clips`) no longer exist — node
      // animations now live in `timeline.clips` keyframes. No-op until the
      // keyframe editor lands (legacy action kept for API stability).
    },

    setAspectRatio: (aspectRatio) => {
      const project = get().project;
      if (project) {
        const size = stageSizeForAspect(aspectRatio);
        set({
          project: syncProjectProtocolContract({
            ...project,
            composition: {
              ...project.composition,
              width: size.width,
              height: size.height,
            },
          }),
        });
      }
    },
  };
}
