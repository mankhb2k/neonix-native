import { DEFAULT_FRAME_DURATION, type FrameDraft } from "../../frame-draft";
import {
  defaultCreateId,
  type CommandContext,
} from "../../ports/command-context";
import type { MotionNode, MotionProject, MotionScene } from "@motionvideo/motion-schema";

/** Tạo ID duy nhất với tiền tố — injectable for tests. */
export function uid(
  prefix: string,
  createId: CommandContext["createId"] = defaultCreateId,
): string {
  return createId(prefix);
}

/** Trích xuất văn bản từ Node dạng Text */
export function nodeText(node: MotionNode | undefined): string {
  return node?.type === "text" && typeof node.payload?.text === "string"
    ? node.payload.text
    : "";
}

/** Cập nhật biến số thuộc tính thương hiệu dự án */
export function updateVariable(
  project: MotionProject,
  id: string,
  value: string,
): MotionProject["variables"] {
  return project.variables.map((variable) => {
    if (variable.id !== id) return variable;
    if (variable.type === "string" || variable.type === "color") {
      return { ...variable, value };
    }
    return variable;
  });
}

/** Cập nhật một Node cụ thể trong một Scene nhất định */
export function mapNode(
  project: MotionProject,
  sceneId: string,
  nodeId: string,
  transform: (node: MotionNode) => MotionNode,
): MotionProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) =>
      scene.id === sceneId
        ? {
            ...scene,
            nodes: scene.nodes.map((node) =>
              node.id === nodeId ? transform(node) : node,
            ),
          }
        : scene,
    ),
  };
}

/** Chuyển đổi FrameDraft từ thư viện thành một MotionScene hoàn chỉnh */
export function sceneFromFrameDraft(
  draft: FrameDraft,
  createId: CommandContext["createId"] = defaultCreateId,
): MotionScene {
  const sceneId = createId("scene");
  const nodeId = createId("node");
  const clipId = createId("clip");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  return {
    id: sceneId,
    name: draft.name,
    duration,
    nodes: [
      {
        id: nodeId,
        type: "text",
        parentId: null,
        zIndex: 0,
        transform: {
          x: 540,
          y: 960,
          width: 900,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: {
          text: draft.text || draft.name,
          fontSize: 64,
          fontWeight: 600,
          align: "center",
        },
      },
    ],
    clips: [
      {
        id: clipId,
        targetId: nodeId,
        schedule: { kind: "absolute", at: 0 },
        duration: Math.min(0.8, duration),
        playback: { iterations: 1, direction: "normal", rate: 1 },
        source: { kind: "preset", presetId: "fade-in" },
      },
    ],
  };
}

export function cloneSceneWithNewIds(
  scene: MotionScene,
  createId: CommandContext["createId"] = defaultCreateId,
): MotionScene {
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionScene;
  const idMap = new Map<string, string>();
  const newSceneId = createId("scene");
  idMap.set(scene.id, newSceneId);
  cloned.id = newSceneId;
  cloned.nodes = (cloned.nodes ?? []).map((node) => {
    const nextId = createId("node");
    idMap.set(node.id, nextId);
    return { ...node, id: nextId };
  });
  cloned.nodes = cloned.nodes.map((node) => ({
    ...node,
    parentId:
      node.parentId && idMap.has(node.parentId)
        ? idMap.get(node.parentId)!
        : node.parentId,
  }));
  cloned.clips = (cloned.clips ?? []).map((clip) => ({
    ...clip,
    id: createId("clip"),
    targetId:
      clip.targetId && idMap.has(clip.targetId)
        ? idMap.get(clip.targetId)!
        : clip.targetId,
  }));
  return cloned;
}
