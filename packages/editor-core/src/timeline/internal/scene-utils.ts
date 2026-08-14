import { DEFAULT_FRAME_DURATION, type FrameDraft } from "../../frame-draft";
import {
  defaultCreateId,
  type CommandContext,
} from "../../ports/command-context";
import type {
  MotionLayer,
  MotionProject,
} from "@motionvideo/motion-protocol";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";

/** Tạo ID duy nhất với tiền tố — injectable for tests. */
export function uid(
  prefix: string,
  createId: CommandContext["createId"] = defaultCreateId,
): string {
  return createId(prefix);
}

/** Trích xuất văn bản từ Node dạng Text */
export function nodeText(node: MotionLayer | undefined): string {
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
  layerId: string,
  transform: (node: MotionLayer) => MotionLayer,
): MotionProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) =>
      scene.id === sceneId
        ? {
            ...scene,
            layers: scene.layers.map((node) =>
              node.id === layerId ? transform(node) : node,
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

/** Composition size from a MotionProject (reads `composition` with metadata.aspectRatio fallback). */
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
  layerId: string,
  composition: CompositionSize,
): MotionLayer {
  const kind = draft.kind ?? "text";
  const textW = Math.min(900, composition.width * 0.7);
  const textH = Math.min(180, composition.height * 0.2);
  const mediaSide = Math.min(composition.width, composition.height) * 0.75;
  const shapeSide = Math.min(420, mediaSide * 0.55);

  if (kind === "shape") {
    let shapePayload: MotionScene["layers"][number]["payload"];
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
      id: layerId,
      type: "shape",
      parentLayerId: null,
      zIndex: 0,
      transform: baseTransform(composition, shapeSide, shapeSide),
      payload: shapePayload,
      style: { fill: "#4A90D9" },
    };
  }

  if (kind === "image" && draft.assetId) {
    return {
      id: layerId,
      type: "image",
      parentLayerId: null,
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
      id: layerId,
      type: "video",
      parentLayerId: null,
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
    id: layerId,
    type: "text",
    parentLayerId: null,
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

/** Public: build a single MotionLayer from a library FrameDraft. */
export function createNodeFromFrameDraft(
  draft: FrameDraft,
  layerId: string,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionLayer {
  return nodeFromDraft(draft, layerId, composition);
}

/** Chuyển đổi FrameDraft từ thư viện thành một MotionScene hoàn chỉnh */
export function sceneFromFrameDraft(
  draft: FrameDraft,
  createId: CommandContext["createId"] = defaultCreateId,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionScene {
  const sceneId = createId("scene");
  const layerId = createId("node");
  const clipId = createId("clip");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  const node = nodeFromDraft(draft, layerId, composition);
  return {
    id: sceneId,
    name: draft.name,
    duration,
    layers: [node],
    clips: [
      {
        id: clipId,
        layerId: layerId,
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
  cloned.layers = (cloned.layers ?? []).map((node) => {
    const nextId = createId("node");
    idMap.set(node.id, nextId);
    return { ...node, id: nextId };
  });
  cloned.layers = cloned.layers.map((node) => ({
    ...node,
    parentLayerId:
      node.parentLayerId && idMap.has(node.parentLayerId)
        ? idMap.get(node.parentLayerId)!
        : node.parentLayerId,
  }));
  cloned.clips = (cloned.clips ?? []).map((clip) => ({
    ...clip,
    id: createId("clip"),
    layerId:
      clip.layerId && idMap.has(clip.layerId)
        ? idMap.get(clip.layerId)!
        : clip.layerId,
  }));
  return cloned;
}
