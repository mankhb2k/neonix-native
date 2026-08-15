import { mapNode, uid, updateVariable } from "@motionvideo/editor-core";
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
      const brand = { ...project.metadata.brand, ...patch };
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
        project: {
          ...project,
          metadata: {
            ...project.metadata,
            name: patch.name ?? project.metadata.name,
            brand,
          },
          variables,
        },
      });
    },

    updateNodeText: (sceneId, layerId, text) => {
      const project = get().project;
      if (!project) return;
      set({
        project: mapNode(project, sceneId, layerId, (node) =>
          node.type === "text"
            ? { ...node, payload: { ...node.payload, text } }
            : node,
        ),
      });
    },

    updateNodePosition: (sceneId, layerId, position) => {
      const project = get().project;
      if (!project) return;
      set({
        project: mapNode(project, sceneId, layerId, (node) => {
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
      });
    },

    updateNodeAnimation: (sceneId, layerId, patch) => {
      const project = get().project;
      if (!project) return;
      set({
        project: {
          ...project,
          scenes: project.scenes.map((scene) => {
            if (scene.id !== sceneId) return scene;
            const existing = scene.clips.find(
              (clip) =>
                clip.layerId === layerId && clip.source.kind === "preset",
            );
            if (!existing) {
              return {
                ...scene,
                clips: [
                  ...scene.clips,
                  {
                    id: uid("clip"),
                    layerId: layerId,
                    schedule: {
                      kind: "absolute",
                      at: Math.max(0, patch.at ?? 0),
                    },
                    duration: Math.max(0.1, patch.duration ?? 0.6),
                    playback: { iterations: 1, direction: "normal", rate: 1 },
                    source: {
                      kind: "preset",
                      presetId: patch.presetId ?? "fade-in",
                    },
                  },
                ],
              };
            }
            return {
              ...scene,
              clips: scene.clips.map((clip) =>
                clip.id !== existing.id
                  ? clip
                  : {
                      ...clip,
                      schedule:
                        patch.at !== undefined
                          ? {
                              kind: "absolute" as const,
                              at: Math.max(0, patch.at),
                            }
                          : clip.schedule,
                      duration:
                        patch.duration !== undefined
                          ? Math.max(0.1, patch.duration)
                          : clip.duration,
                      source:
                        clip.source.kind === "preset" &&
                        patch.presetId !== undefined
                          ? { ...clip.source, presetId: patch.presetId }
                          : clip.source,
                    },
              ),
            };
          }),
        },
      });
    },

    setAspectRatio: (aspectRatio) => {
      const project = get().project;
      if (project) {
        set({
          project: {
            ...project,
            metadata: { ...project.metadata, aspectRatio },
          },
        });
      }
    },
  };
}
