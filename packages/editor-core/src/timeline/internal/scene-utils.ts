import { DEFAULT_FRAME_DURATION, type FrameDraft } from "../../frame-draft";
import {
  defaultCreateId,
  type CommandContext,
} from "../../ports/command-context";
import type {
  MotionNode,
  MotionProject,
  MotionScene,
} from "@motionvideo/motion-protocol";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";

/** Tạo ID duy nhất với tiền tố — injectable for tests. */
export function uid(
  prefix: string,
  createId: CommandContext["createId"] = defaultCreateId,
): string {
  return createId(prefix);
}

/** Trích xuất văn bản từ Node dạng Text */
export function nodeText(node: MotionNode | undefined): string {
  return node?.type === "text" ? getTextPayloadPlain(node.payload) : "";
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

export type CompositionSize = {
  width: number;
  height: number;
};

/** Stage size for project aspect ratio (matches desktop preview). */
export function stageSizeForAspect(aspectRatio: string): CompositionSize {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

/** Composition size from a v2|v3 project (v3 reads `composition`, v2 falls back to `metadata.aspectRatio`). */
export function stageSizeForProject(
  project: Pick<MotionProject, "metadata" | "composition">,
): CompositionSize {
  if (
    "composition" in project &&
    project.composition?.width &&
    project.composition?.height
  ) {
    return {
      width: project.composition.width,
      height: project.composition.height,
    };
  }
  const aspect =
    (project.metadata as { aspectRatio?: string }).aspectRatio ?? "16:9";
  return stageSizeForAspect(aspect);
}

const DEFAULT_COMPOSITION: CompositionSize = { width: 1920, height: 1080 };

function baseTransform(
  composition: CompositionSize,
  width: number,
  height: number,
) {
  return {
    x: composition.width / 2,
    y: composition.height / 2,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    opacity: 1,
    visible: true,
    flipX: false,
    flipY: false,
  };
}

function nodeFromDraft(
  draft: FrameDraft,
  nodeId: string,
  composition: CompositionSize,
): MotionNode {
  const kind = draft.kind ?? "text";
  const textW = Math.min(900, composition.width * 0.7);
  const textH = Math.min(180, composition.height * 0.2);
  const mediaSide = Math.min(composition.width, composition.height) * 0.75;
  const shapeSide = Math.min(420, mediaSide * 0.55);

  if (kind === "shape") {
    let shapePayload: MotionScene["nodes"][number]["payload"];
    if (draft.shape === "ellipse" || draft.shape === "circle") {
      shapePayload = { shape: "ellipse" };
    } else if (draft.shape === "polygon") {
      shapePayload = {
        shape: "polygon",
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      };
    } else {
      shapePayload = { shape: "rectangle", cornerRadius: 0 };
    }
    return {
      id: nodeId,
      type: "shape",
      parentId: null,
      zIndex: 0,
      transform: baseTransform(composition, shapeSide, shapeSide),
      payload: shapePayload,
      style: { fill: "#4A90D9" },
    };
  }

  if (kind === "image" && draft.assetId) {
    return {
      id: nodeId,
      type: "image",
      parentId: null,
      zIndex: 0,
      transform: baseTransform(composition, mediaSide, mediaSide),
      payload: {
        assetId: draft.assetId,
        fit: "contain",
      },
    };
  }

  if (kind === "video" && draft.assetId) {
    return {
      id: nodeId,
      type: "video",
      parentId: null,
      zIndex: 0,
      transform: baseTransform(composition, mediaSide, mediaSide),
      payload: {
        assetId: draft.assetId,
        fit: "contain",
        muted: true,
      },
    };
  }

  return {
    id: nodeId,
    type: "text",
    parentId: null,
    zIndex: 0,
    transform: baseTransform(composition, textW, textH),
    payload: {
      text: draft.text || draft.name,
      fontSize: 64,
      fontWeight: 600,
      align: "center",
    },
  };
}

/** Public: build a single MotionNode from a library FrameDraft. */
export function createNodeFromFrameDraft(
  draft: FrameDraft,
  nodeId: string,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionNode {
  return nodeFromDraft(draft, nodeId, composition);
}

/** Chuyển đổi FrameDraft từ thư viện thành một MotionScene hoàn chỉnh */
export function sceneFromFrameDraft(
  draft: FrameDraft,
  createId: CommandContext["createId"] = defaultCreateId,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionScene {
  const sceneId = createId("scene");
  const nodeId = createId("node");
  const clipId = createId("clip");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  const node = nodeFromDraft(draft, nodeId, composition);
  return {
    id: sceneId,
    name: draft.name,
    duration,
    nodes: [node],
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
