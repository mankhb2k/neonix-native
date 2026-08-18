import { DEFAULT_FRAME_DURATION, type FrameDraft } from "../../frame-draft";
import {
  defaultCreateId,
  type CommandContext,
} from "../../ports/command-context";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";
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

/** Cập nhật một Node cụ thể trong cây layer */
export function mapNode(
  project: MotionProject,
  _sceneId: string,
  layerId: string,
  transform: (node: MotionLayer) => MotionLayer,
): MotionProject {
  const mapLayers = (layers: MotionLayer[]): MotionLayer[] =>
    layers.map((layer) => {
      if (layer.id === layerId) return transform(layer);
      if (layer.type === "group") {
        return { ...layer, children: mapLayers(layer.children) };
      }
      return layer;
    });
  return {
    ...project,
    layers: mapLayers(project.layers),
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

/** Visual leaf nodes produced from a library FrameDraft (never audio/camera). */
type DraftVisualNode = Extract<
  MotionLayer,
  { type: "shape" | "image" | "video" | "text" }
>;

function baseTransform(
  composition: CompositionSize,
  width: number,
  height: number,
) {
  return visualLayerAtoms({
    x: composition.width / 2,
    y: composition.height / 2,
    width,
    height,
  });
}

function nodeFromDraft(
  draft: FrameDraft,
  layerId: string,
  composition: CompositionSize,
): DraftVisualNode {
  const kind = draft.kind ?? "text";
  const textW = Math.min(900, composition.width * 0.7);
  const textH = Math.min(180, composition.height * 0.2);
  const mediaSide = Math.min(composition.width, composition.height) * 0.75;
  const shapeSide = Math.min(420, mediaSide * 0.55);

  if (kind === "shape") {
    let shapePayload: Extract<MotionLayer, { type: "shape" }>["payload"];
    if (draft.shape === "ellipse" || draft.shape === "circle") {
      shapePayload = { shape: "ellipse" };
    } else if (draft.shape === "polygon") {
      shapePayload = {
        shape: "polygon",
        points: [
          { x: 0.5, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
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
      ...baseTransform(composition, shapeSide, shapeSide),
      timing: { start: 0, duration: 1 },
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
      ...baseTransform(composition, mediaSide, mediaSide),
      timing: { start: 0, duration: 1 },
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
      ...baseTransform(composition, mediaSide, mediaSide),
      timing: { start: 0, duration: 1 },
      payload: {
        assetId: draft.assetId,
        fit: "contain",
        loop: false,
        muted: true,
      },
    };
  }

  return {
    id: layerId,
    type: "text",
    parentLayerId: null,
    zIndex: 0,
    ...baseTransform(composition, textW, textH),
    timing: { start: 0, duration: 1 },
    payload: {
      text: draft.text.trim() || draft.name.trim() || "Text",
      fontSize: 64,
      color: "#111111",
      alignment: "center",
      wrap: "word",
      overflow: "visible",
    },
  };
}

/** Public: build a single MotionLayer from a library FrameDraft. */
export function createNodeFromFrameDraft(
  draft: FrameDraft,
  layerId: string,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): DraftVisualNode {
  return nodeFromDraft(draft, layerId, composition);
}

/** Chuyển FrameDraft thành layer gốc (shape/text/video/image) — không bọc group. */
export function sceneFromFrameDraft(
  draft: FrameDraft,
  createId: CommandContext["createId"] = defaultCreateId,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionLayer {
  const layerId = createId("scene");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  const node = nodeFromDraft(draft, layerId, composition);
  const name = draft.name.trim() || draft.kind || "Clip";
  return {
    ...node,
    name,
    parentLayerId: null,
    timing: { start: 0, duration },
  };
}

export function cloneSceneWithNewIds(
  scene: MotionLayer,
  createId: CommandContext["createId"] = defaultCreateId,
): MotionLayer {
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionLayer;
  const newSceneId = createId("scene");

  const remapChildren = (nodes: MotionLayer[]): MotionLayer[] =>
    nodes.map((node) => {
      const nextId = createId("node");
      const children =
        node.type === "group" ? remapChildren(node.children) : undefined;
      return {
        ...node,
        id: nextId,
        ...(children ? { children } : {}),
        parentLayerId:
          node.parentLayerId === scene.id ? newSceneId : node.parentLayerId,
      } as MotionLayer;
    });

  cloned.id = newSceneId;
  if (cloned.type === "group") {
    cloned.children = remapChildren(cloned.children);
  }
  return cloned;
}
