import { applyMatrix, type Matrix2D } from "./matrix";
import { evaluateScene, type EvaluatedNode, type RuntimeNode, type RuntimeScene } from "./evaluator";
import type { Bounds2D } from "./spatial";

export type RenderItemKey = string;

export type RenderItemPayload =
  | {
      kind: "text";
      text: string;
      fontSize: number;
      fontWeight?: number;
      align?: "left" | "center" | "right";
      fill?: string;
    }
  | {
      kind: "shape";
      shape: "rectangle" | "ellipse" | "polygon";
      fill?: string;
      cornerRadius?: number;
      width: number;
      height: number;
    }
  | {
      kind: "solid";
      fill?: string;
      width: number;
      height: number;
    }
  | {
      kind: "image";
      assetId: string;
      width: number;
      height: number;
    }
  | {
      kind: "group";
      width: number;
      height: number;
    }
  | {
      kind: "unknown";
      nodeType: string;
    };

export type RenderSnapshotItem = {
  key: RenderItemKey;
  sceneId: string;
  nodeId: string;
  parentNodeId?: string;
  nodeType: string;
  worldMatrix: Matrix2D;
  worldBounds: Bounds2D;
  worldOpacity: number;
  visible: boolean;
  selectable: boolean;
  locked: boolean;
  renderOrder: number;
  payload: RenderItemPayload;
};

export type RenderSnapshot = {
  sceneId: string;
  frame: number;
  time: number;
  width: number;
  height: number;
  background?: string;
  items: RenderSnapshotItem[];
};

function resolveFill(style: { fill?: unknown } | undefined): string | undefined {
  if (!style?.fill) return undefined;
  if (typeof style.fill === "string") return style.fill;
  if (
    typeof style.fill === "object" &&
    style.fill !== null &&
    "stops" in style.fill &&
    Array.isArray((style.fill as { stops: Array<{ color: string }> }).stops)
  ) {
    return (style.fill as { stops: Array<{ color: string }> }).stops[0]?.color;
  }
  return undefined;
}

function nodeStyle(node: RuntimeNode): { fill?: unknown } | undefined {
  if ("style" in node) {
    return (node as { style?: { fill?: unknown } }).style;
  }
  return undefined;
}

function payloadForNode(node: RuntimeNode, evaluated: EvaluatedNode): RenderItemPayload {
  const { width, height } = evaluated.transform;
  const style = nodeStyle(node);
  switch (node.type) {
    case "text": {
      const textNode = node as RuntimeNode & {
        payload: {
          text: string;
          fontSize: number;
          fontWeight?: number;
          align?: "left" | "center" | "right";
        };
      };
      return {
        kind: "text",
        text: textNode.payload.text,
        fontSize: textNode.payload.fontSize,
        fontWeight: textNode.payload.fontWeight,
        align: textNode.payload.align,
        fill: resolveFill(style) ?? "#ebe6dc",
      };
    }
    case "shape": {
      const shapeNode = node as RuntimeNode & {
        payload: {
          shape: "rectangle" | "ellipse" | "polygon";
          cornerRadius?: number;
        };
      };
      return {
        kind: "shape",
        shape: shapeNode.payload.shape,
        fill: resolveFill(style) ?? "#c4843a",
        cornerRadius: shapeNode.payload.cornerRadius,
        width,
        height,
      };
    }
    case "solid": {
      const solidNode = node as RuntimeNode & {
        payload: { color: string; width: number; height: number };
      };
      return {
        kind: "solid",
        fill: resolveFill(style) ?? solidNode.payload.color ?? "#1a1916",
        width,
        height,
      };
    }
    case "image": {
      const imageNode = node as RuntimeNode & {
        payload: { assetId: string };
      };
      return {
        kind: "image",
        assetId: imageNode.payload.assetId,
        width,
        height,
      };
    }
    case "group":
      return { kind: "group", width, height };
    default:
      return { kind: "unknown", nodeType: node.type };
  }
}

function isDrawable(type: string): boolean {
  return type === "text" || type === "shape" || type === "solid" || type === "image" || type === "group";
}

/**
 * Build a frame-local RenderSnapshot from an evaluated scene.
 * Groups are included for hierarchy/hit-test; painters may skip empty groups.
 */
export function buildRenderSnapshot(input: {
  scene: RuntimeScene;
  time: number;
  frame: number;
  width: number;
  height: number;
  background?: string;
}): RenderSnapshot {
  const evaluated = evaluateScene(input.scene, input.time);
  const ordered = [...evaluated].sort((a, b) => {
    const zA = a.node.zIndex ?? 0;
    const zB = b.node.zIndex ?? 0;
    if (zA !== zB) return zA - zB;
    return a.node.id.localeCompare(b.node.id);
  });

  const items: RenderSnapshotItem[] = [];
  let renderOrder = 0;
  for (const item of ordered) {
    if (!isDrawable(item.node.type)) continue;
    items.push({
      key: `${input.scene.id}:${item.node.id}`,
      sceneId: input.scene.id,
      nodeId: item.node.id,
      parentNodeId: item.node.parentId ?? undefined,
      nodeType: item.node.type,
      worldMatrix: item.worldMatrix,
      worldBounds: item.worldBounds,
      worldOpacity: item.worldOpacity,
      visible: item.visible,
      selectable: item.visible && item.worldOpacity > 0.01,
      locked: false,
      renderOrder: renderOrder++,
      payload: payloadForNode(item.node, item),
    });
  }

  return {
    sceneId: input.scene.id,
    frame: input.frame,
    time: input.time,
    width: input.width,
    height: input.height,
    background: input.background,
    items,
  };
}

export function matrixToCssTransform(matrix: Matrix2D): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}

export function worldOrigin(matrix: Matrix2D): { x: number; y: number } {
  return applyMatrix(matrix, 0, 0);
}
