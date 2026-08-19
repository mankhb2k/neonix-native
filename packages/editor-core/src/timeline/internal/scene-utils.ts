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

/** Trích xuất văn bản từ layer dạng Text */
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

/** Cập nhật một layer cụ thể trong cây layer */
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

/** Stage size theo aspect ratio dự án (khớp preview desktop). */
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

/** Composition size từ MotionProject (đọc `composition`; fallback mặc định 16:9). */
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
  // Protocol V1 không chứa aspectRatio trong metadata — fallback mặc định 16:9.
  return stageSizeForAspect("16:9");
}

const DEFAULT_COMPOSITION: CompositionSize = { width: 1920, height: 1080 };

/** Layer visual lá tạo từ FrameDraft thư viện (không bao giờ audio/camera). */
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
    if (draft.shape === "ellipse") {
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

/** Public: dựng một MotionLayer từ FrameDraft thư viện. */
export function createNodeFromFrameDraft(
  draft: FrameDraft,
  layerId: string,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): DraftVisualNode {
  return nodeFromDraft(draft, layerId, composition);
}

/** Chuyển FrameDraft thành layer gốc (shape/text/video/image) — không bọc group. */
export function layerFromFrameDraft(
  draft: FrameDraft,
  createId: CommandContext["createId"] = defaultCreateId,
  composition: CompositionSize = DEFAULT_COMPOSITION,
): MotionLayer {
  const layerId = createId("layer");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  const node = nodeFromDraft(draft, layerId, composition);
  return {
    ...node,
    parentLayerId: null,
    timing: { start: 0, duration },
  };
}

function remapAnimationIds(layer: MotionLayer): MotionLayer {
  if (layer.type === "group") {
    return {
      ...layer,
      children: layer.children.map((child) => remapAnimationIds(child)),
    };
  }
  return layer;
}

export function cloneLayerWithNewIds(
  layer: MotionLayer,
  createId: CommandContext["createId"] = defaultCreateId,
): MotionLayer {
  const cloned = JSON.parse(JSON.stringify(layer)) as MotionLayer;
  const newLayerId = createId("layer");

  // Each node gets a fresh id AND its `parentLayerId` re-points to the fresh
  // id of its actual parent (threaded down), so nested groups stay a valid
  // tree — not just root children (the old code only remapped the root).
  const remapChildren = (
    nodes: MotionLayer[],
    newParentId: string,
  ): MotionLayer[] =>
    nodes.map((node) => {
      const nextId = createId("node");
      const children =
        node.type === "group"
          ? remapChildren(node.children, nextId)
          : undefined;
      return {
        ...node,
        id: nextId,
        ...(children ? { children } : {}),
        parentLayerId: newParentId,
      } as MotionLayer;
    });

  cloned.id = newLayerId;
  if (cloned.type === "group") {
    cloned.children = remapChildren(cloned.children, newLayerId);
  }
  return remapAnimationIds(cloned);
}

/** @deprecated Use `layerFromFrameDraft` (layer vocabulary). */
export const sceneFromFrameDraft: typeof layerFromFrameDraft = (
  draft,
  createId,
  composition,
) => layerFromFrameDraft(draft, createId, composition);

/** @deprecated Use `cloneLayerWithNewIds` (layer vocabulary). */
export const cloneSceneWithNewIds: typeof cloneLayerWithNewIds = (
  layer,
  createId,
) => cloneLayerWithNewIds(layer, createId);
