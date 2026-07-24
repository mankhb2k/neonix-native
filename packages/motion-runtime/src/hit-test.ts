import { evaluateScene, type EvaluatedNode, type RuntimeScene } from "./evaluator";
import { applyMatrix } from "./matrix";
import { containsPoint, invertMatrix, unionBounds, type Bounds2D, type Point2D } from "./spatial";

const DRAWABLE_NODE_TYPES = new Set(["text", "shape", "image", "svg", "video"]);

export function isDrawableNode(item: EvaluatedNode): boolean {
  return DRAWABLE_NODE_TYPES.has(item.node.type);
}

export function hitTestNode(item: EvaluatedNode, point: Point2D, includeContainers = false): boolean {
  if (!item.visible || item.worldOpacity <= 0 || (!includeContainers && !isDrawableNode(item))) return false;
  if (!containsPoint(item.worldBounds, point)) return false;
  const inverse = invertMatrix(item.worldMatrix);
  if (!inverse) return false;
  const local = applyMatrix(inverse, point.x, point.y);
  return local.x >= 0 && local.x <= item.transform.width && local.y >= 0 && local.y <= item.transform.height;
}

export function hitTestScene(scene: RuntimeScene, time: number, point: Point2D, includeContainers = false): EvaluatedNode[] {
  return evaluateScene(scene, time)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => hitTestNode(item, point, includeContainers))
    .sort((left, right) => ((right.item.node.zIndex ?? 0) - (left.item.node.zIndex ?? 0)) || right.index - left.index)
    .map(({ item }) => item);
}

export function subtreeBounds(evaluated: EvaluatedNode[], rootId: string, drawableOnly = true): Bounds2D | undefined {
  const byParent = new Map<string | null, EvaluatedNode[]>();
  for (const item of evaluated) {
    const siblings = byParent.get(item.node.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.node.parentId, siblings);
  }
  const root = evaluated.find((item) => item.node.id === rootId);
  if (!root) return undefined;
  let result: Bounds2D | undefined;
  const visit = (item: EvaluatedNode): void => {
    if (item.visible && (!drawableOnly || isDrawableNode(item))) result = unionBounds(result, item.worldBounds);
    for (const child of byParent.get(item.node.id) ?? []) visit(child);
  };
  visit(root);
  return result;
}
