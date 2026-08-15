import { applyMatrix, multiplyMatrix, type Matrix2D } from "./matrix";
import type { Matrix4 } from "./matrix4";
import {
  evaluateScene,
  type EvaluatedNode,
  type RuntimeEffect,
  type RuntimeNode,
  type RuntimeScene,
} from "./evaluator";
import { cameraViewMatrix } from "./camera-view";
import type { PathContour } from "./geometry";
import { buildRenderPlan } from "./render-plan";
import {
  hierarchyRenderOrder,
  type OrderableNode,
} from "./composition/render-order";
import {
  containsPoint,
  invertMatrix,
  transformBounds,
  type Bounds2D,
  type Point2D,
} from "./spatial";

export type RenderItemKey = string;

export type PaintFillSolid = { type: "solid"; color: string };
export type PaintFillGradient = {
  type: "linear-gradient" | "radial-gradient";
  angle?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  stops: Array<{ offset: number; color: string }>;
};
export type PaintFill = PaintFillSolid | PaintFillGradient;

export type RenderItemPayload =
  | {
      kind: "text";
      text: string;
      fontSize: number;
      fontWeight?: number;
      align?: "left" | "center" | "right";
      fill?: string;
      fillPaint?: PaintFill;
      fontAssetId?: string;
      wrap?: "none" | "word" | "character";
      lineHeight?: number;
      letterSpacing?: number;
      maxLines?: number;
      overflow?: "visible" | "clip" | "ellipsis";
      runs?: Array<{
        id: string;
        text: string;
        fill?: string;
        fontAssetId?: string;
        fontWeight?: number;
        fontStyle?: "normal" | "italic";
        fontScale?: number;
        letterSpacing?: number;
        highlight?: {
          fill: string;
          paddingX?: number;
          paddingY?: number;
          radius?: number;
        };
        sourceRef?: { kind: "text-run"; layerId: string; runId: string };
      }>;
    }
  | {
      kind: "shape";
      shape: "rectangle" | "ellipse" | "polygon";
      fill?: string;
      fillPaint?: PaintFill;
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
      uri?: string;
      width: number;
      height: number;
    }
  | {
      kind: "path";
      contours: PathContour[];
      fillRule: "nonzero" | "evenodd";
      fill?: string;
      fillPaint?: PaintFill;
      stroke?: string;
      strokeWidth?: number;
      fillOpacity?: number;
      strokeOpacity?: number;
    }
  | {
      kind: "video";
      assetId: string;
      uri?: string;
      width: number;
      height: number;
      mediaTime: number;
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
  graphId: string;
  layerId: string;
  parentLayerId?: string;
  nodeType: string;
  worldMatrix: Matrix2D;
  /** 4×4 world matrix for perspective-3d space. @since Phase 11 */
  worldMatrix4?: Matrix4;
  worldBounds: Bounds2D;
  worldOpacity: number;
  visible: boolean;
  selectable: boolean;
  locked: boolean;
  renderOrder: number;
  payload: RenderItemPayload;
  depth: number;
  projectedOffset: { x: number; y: number };
  blendMode?:
    | "normal"
    | "multiply"
    | "screen"
    | "add"
    | "darken"
    | "lighten"
    | "overlay";
  effects?: RuntimeEffect[];
  /** Compositing scope from {@link buildRenderPlan} — drives beginLayer/endLayer. */
  compositing?: {
    isolation: "pass-through" | "isolate";
    needsOffscreen: boolean;
    isAdjustment: boolean;
    groupCompositing?: "pass-through" | "isolate";
    mask?: {
      mode: "clip" | "alpha" | "inverse-alpha" | "luma" | "inverse-luma";
      sourceLayerId: string;
      sourceVisibility: "mask-only" | "content-and-mask";
    };
    effectOrder: Array<{ id: string; type: string }>;
  };
};

export type RenderSnapshot = {
  graphId: string;
  frame: number;
  time: number;
  width: number;
  height: number;
  background?: string;
  space: "flat-2d" | "layered-2.5d" | "perspective-3d";
  projection: {
    kind: "orthographic";
    cameraId?: string;
  };
  /** View matrix applied to items (identity when no active camera). */
  cameraMatrix: Matrix2D;
  items: RenderSnapshotItem[];
};

function resolvePaintFill(style: { fill?: unknown } | undefined): {
  fill?: string;
  fillPaint?: PaintFill;
} {
  if (!style?.fill) return {};
  if (typeof style.fill === "string") {
    return {
      fill: style.fill,
      fillPaint: { type: "solid", color: style.fill },
    };
  }
  if (
    typeof style.fill === "object" &&
    style.fill !== null &&
    "type" in style.fill &&
    "stops" in style.fill &&
    Array.isArray((style.fill as { stops: unknown }).stops)
  ) {
    const g = style.fill as {
      type: "linear-gradient" | "radial-gradient";
      angle?: number;
      cx?: number;
      cy?: number;
      radius?: number;
      stops: Array<{ offset: number; color: string }>;
    };
    const first = g.stops[0]?.color;
    return {
      ...(first ? { fill: first } : {}),
      fillPaint: {
        type: g.type,
        ...(g.angle != null ? { angle: g.angle } : {}),
        ...(g.cx != null ? { cx: g.cx } : {}),
        ...(g.cy != null ? { cy: g.cy } : {}),
        ...(g.radius != null ? { radius: g.radius } : {}),
        stops: g.stops,
      },
    };
  }
  return {};
}

function nodeStyle(node: RuntimeNode):
  | {
      fill?: unknown;
      stroke?: unknown;
      strokeWidth?: number;
      fillOpacity?: number;
      strokeOpacity?: number;
    }
  | undefined {
  if ("style" in node) {
    return (node as { style?: Record<string, unknown> }).style as
      | {
          fill?: unknown;
          stroke?: unknown;
          strokeWidth?: number;
          fillOpacity?: number;
          strokeOpacity?: number;
        }
      | undefined;
  }
  return undefined;
}

function payloadForNode(
  node: RuntimeNode,
  evaluated: EvaluatedNode,
  assetUriById?: Map<string, string> | Record<string, string>,
  sceneTime = 0,
): RenderItemPayload {
  const { width, height } = evaluated.transform;
  const style = nodeStyle(node);
  const paint = resolvePaintFill(style);
  switch (node.type) {
    case "text": {
      const textNode = node as RuntimeNode & {
        payload: {
          text?: string;
          fontSize: number;
          color?: string;
          alignment?: "left" | "center" | "right";
          fontAssetId?: string;
          wrap?: "none" | "word" | "character";
          lineHeight?: number;
          letterSpacing?: number;
          maxLines?: number;
          overflow?: "visible" | "clip" | "ellipsis";
        };
      };
      const plain = textNode.payload.text ?? "";
      return {
        kind: "text",
        text: plain,
        fontSize: textNode.payload.fontSize,
        align: textNode.payload.alignment,
        fontAssetId: textNode.payload.fontAssetId,
        wrap: textNode.payload.wrap,
        lineHeight: textNode.payload.lineHeight,
        letterSpacing: textNode.payload.letterSpacing,
        maxLines: textNode.payload.maxLines,
        overflow: textNode.payload.overflow,
        fill: paint.fill ?? textNode.payload.color ?? "#ebe6dc",
        ...(paint.fillPaint ? { fillPaint: paint.fillPaint } : {}),
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
        fill: paint.fill ?? "#c4843a",
        ...(paint.fillPaint ? { fillPaint: paint.fillPaint } : {}),
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
        fill: paint.fill ?? solidNode.payload.color ?? "#1a1916",
        width,
        height,
      };
    }
    case "image": {
      const imageNode = node as RuntimeNode & {
        payload: { assetId: string };
      };
      const uri =
        assetUriById instanceof Map
          ? assetUriById.get(imageNode.payload.assetId)
          : assetUriById?.[imageNode.payload.assetId];
      return {
        kind: "image",
        assetId: imageNode.payload.assetId,
        ...(uri ? { uri } : {}),
        width,
        height,
      };
    }
    case "svg": {
      const svgNode = node as RuntimeNode & {
        payload: { assetId: string };
      };
      const uri =
        assetUriById instanceof Map
          ? assetUriById.get(svgNode.payload.assetId)
          : assetUriById?.[svgNode.payload.assetId];
      return {
        kind: "image",
        assetId: svgNode.payload.assetId,
        ...(uri ? { uri } : {}),
        width,
        height,
      };
    }
    case "path": {
      const pathNode = node as Extract<RuntimeNode, { type: "path" }>;
      const contours = evaluated.paintContours ?? pathNode.payload.contours;
      return {
        kind: "path",
        contours,
        fillRule: pathNode.payload.fillRule ?? "nonzero",
        fill: paint.fill,
        ...(paint.fillPaint ? { fillPaint: paint.fillPaint } : {}),
        ...(typeof style?.stroke === "string" ? { stroke: style.stroke } : {}),
        ...(style?.strokeWidth != null
          ? { strokeWidth: style.strokeWidth }
          : {}),
        ...(style?.fillOpacity != null
          ? { fillOpacity: style.fillOpacity }
          : {}),
        ...(style?.strokeOpacity != null
          ? { strokeOpacity: style.strokeOpacity }
          : {}),
      };
    }
    case "video": {
      const videoNode = node as Extract<RuntimeNode, { type: "video" }>;
      const uri =
        assetUriById instanceof Map
          ? assetUriById.get(videoNode.payload.assetId)
          : assetUriById?.[videoNode.payload.assetId];
      const trimStart = videoNode.payload.trimStart ?? 0;
      return {
        kind: "video",
        assetId: videoNode.payload.assetId,
        ...(uri ? { uri } : {}),
        width,
        height,
        mediaTime: trimStart + sceneTime,
      };
    }
    case "group":
      return { kind: "group", width, height };
    default:
      return { kind: "unknown", nodeType: node.type };
  }
}

function isDrawable(type: string): boolean {
  return (
    type === "text" ||
    type === "shape" ||
    type === "solid" ||
    type === "image" ||
    type === "svg" ||
    type === "group" ||
    type === "path" ||
    type === "video"
  );
}

function resolveCameraMatrix(
  scene: RuntimeScene,
  evaluated: EvaluatedNode[],
  width: number,
  height: number,
): Matrix2D {
  const cameraId = scene.activeCameraLayerId;
  if (!cameraId) {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
  const cam = evaluated.find(
    (item) => item.layer.id === cameraId && item.layer.type === "camera",
  );
  if (!cam || cam.layer.type !== "camera") {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
  const zoom =
    typeof cam.layer.payload.zoom === "number" ? cam.layer.payload.zoom : 1;
  return cameraViewMatrix(
    {
      x: cam.transform.x,
      y: cam.transform.y,
      rotation: cam.transform.rotation,
      zoom,
    },
    width,
    height,
  );
}

/**
 * Build a frame-local RenderSnapshot from an evaluated scene.
 * Groups are included for hierarchy/hit-test; painters may skip empty groups.
 * Active camera view is baked into item world matrices (worker parity).
 */
export function buildRenderSnapshot(input: {
  scene: RuntimeScene;
  time: number;
  frame: number;
  width: number;
  height: number;
  background?: string;
  /** Optional asset uri lookup for painters (image/svg/video). */
  assetUriById?: Map<string, string> | Record<string, string>;
}): RenderSnapshot {
  const evaluated = evaluateScene(input.scene, input.time);
  const renderPlan = buildRenderPlan(input.scene, evaluated, {
    time: input.time,
  });
  const passByNodeId = new Map(
    renderPlan.passes.map((pass) => [pass.layerId, pass]),
  );
  const cameraMatrix = resolveCameraMatrix(
    input.scene,
    evaluated,
    input.width,
    input.height,
  );
  const ordered = hierarchyRenderOrder(
    evaluated as OrderableNode[],
  ) as EvaluatedNode[];

  const items: RenderSnapshotItem[] = [];
  let renderOrder = 0;
  for (const item of ordered) {
    if (!isDrawable(item.layer.type)) continue;
    const worldMatrix = multiplyMatrix(cameraMatrix, item.worldMatrix);
    const worldBounds = transformBounds(cameraMatrix, item.worldBounds);
    const pass = passByNodeId.get(item.layer.id);
    items.push({
      key: `${input.scene.id}:${item.layer.id}`,
      graphId: input.scene.id,
      layerId: item.layer.id,
      parentLayerId: item.layer.parentLayerId ?? undefined,
      nodeType: item.layer.type,
      worldMatrix,
      ...(item.worldMatrix4 ? { worldMatrix4: item.worldMatrix4 } : {}),
      worldBounds,
      worldOpacity: item.worldOpacity,
      visible: item.visible,
      selectable: item.visible && item.worldOpacity > 0.01,
      locked: false,
      renderOrder: renderOrder++,
      payload: payloadForNode(item.layer, item, input.assetUriById, input.time),
      depth: item.depth,
      projectedOffset: item.projectedOffset,
      ...(item.layer.compositing?.["blend-mode"]
        ? { blendMode: item.layer.compositing["blend-mode"] }
        : {}),
      ...(item.effects?.length ? { effects: item.effects } : {}),
      ...(pass
        ? {
            compositing: {
              isolation: pass.isolation,
              needsOffscreen: pass.needsOffscreen,
              isAdjustment: pass.isAdjustment,
              ...(pass.groupCompositing
                ? { groupCompositing: pass.groupCompositing }
                : {}),
              ...(pass.mask
                ? {
                    mask: {
                      mode: pass.mask.mode,
                      sourceLayerId: pass.mask.sourceLayerId,
                      sourceVisibility: pass.mask.sourceVisibility,
                    },
                  }
                : {}),
              effectOrder: pass.effects.map((fx) => ({
                id: fx.id,
                type: fx.type,
              })),
            },
          }
        : {}),
    });
  }

  return {
    graphId: input.scene.id,
    frame: input.frame,
    time: input.time,
    width: input.width,
    height: input.height,
    background: input.background,
    space: input.scene.space ?? "flat-2d",
    projection: {
      kind: "orthographic",
      ...(input.scene.activeCameraLayerId
        ? { cameraId: input.scene.activeCameraLayerId }
        : {}),
    },
    cameraMatrix,
    items,
  };
}

export function matrixToCssTransform(matrix: Matrix2D): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}

export function worldOrigin(matrix: Matrix2D): { x: number; y: number } {
  return applyMatrix(matrix, 0, 0);
}

function itemLocalHit(item: RenderSnapshotItem, point: Point2D): boolean {
  if (!item.visible || !item.selectable || item.locked) return false;
  if (item.payload.kind === "group" || item.payload.kind === "unknown") {
    return false;
  }
  if (!containsPoint(item.worldBounds, point)) return false;
  const inverse = invertMatrix(item.worldMatrix);
  if (!inverse) return false;
  const local = applyMatrix(inverse, point.x, point.y);
  if (item.payload.kind === "path") {
    return containsPoint(item.worldBounds, point);
  }
  const width =
    item.payload.kind === "text"
      ? item.worldBounds.width
      : "width" in item.payload
        ? item.payload.width
        : item.worldBounds.width;
  const height =
    item.payload.kind === "text"
      ? item.worldBounds.height
      : "height" in item.payload
        ? item.payload.height
        : item.worldBounds.height;
  return local.x >= 0 && local.x <= width && local.y >= 0 && local.y <= height;
}

/**
 * Hit-test against a frame RenderSnapshot (top-most first).
 * Canonical selection path — do not use DOM event targets.
 */
export function hitTestRenderSnapshot(
  snapshot: RenderSnapshot,
  point: Point2D,
): RenderSnapshotItem[] {
  return [...snapshot.items]
    .filter((item) => itemLocalHit(item, point))
    .sort((a, b) => b.renderOrder - a.renderOrder);
}
