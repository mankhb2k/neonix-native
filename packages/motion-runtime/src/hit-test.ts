import { evaluateScene, type EvaluatedNode, type RuntimeScene } from "./evaluator";
import { applyMatrix } from "./matrix";
import { containsPoint, invertMatrix, unionBounds, type Bounds2D, type Point2D } from "./spatial";
import {
  hierarchyRenderOrderReverse,
} from "./composition/render-order";

const DRAWABLE_NODE_TYPES = new Set(["text", "shape", "path", "image", "svg", "video"]);

export function isDrawableNode(item: EvaluatedNode): boolean {
  return DRAWABLE_NODE_TYPES.has(item.layer.type);
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
  const evaluated = evaluateScene(scene, time);
  const byId = new Map(evaluated.map((item) => [item.layer.id, item]));
  const visibleMaskSources = new Set(scene.layers.filter((node) => node.compositing?.mask?.["source-visibility"] === "content-and-mask").map((node) => node.compositing!.mask!.sourceLayerId));
  const hiddenMaskSources = new Set(scene.layers.filter((node) => node.compositing?.mask?.["source-visibility"] === "mask-only").map((node) => node.compositing!.mask!.sourceLayerId));
  // Sort all layers by hierarchy (top-first) so parent groups anchor children properly
  const ordered = hierarchyRenderOrderReverse(evaluated);
  return ordered.filter((item) => {
    if (hiddenMaskSources.has(item.layer.id) && !visibleMaskSources.has(item.layer.id)) return false;
    if (!hitTestNode(item, point, includeContainers)) return false;
    if (!item.layer.mask) return true;
    const source = byId.get(item.layer.mask.sourceLayerId);
    if (!source) return false;
    const inside = containsPoint(source.worldBounds, point);
    if (item.layer.mask.mode === "inverse-alpha" || item.layer.mask.mode === "inverse-luma") return !inside;
    return inside;
  });
}

export function subtreeBounds(evaluated: EvaluatedNode[], rootId: string, drawableOnly = true): Bounds2D | undefined {
  const byParent = new Map<string | null, EvaluatedNode[]>();
  for (const item of evaluated) {
    const siblings = byParent.get(item.layer.parentLayerId) ?? [];
    siblings.push(item);
    byParent.set(item.layer.parentLayerId, siblings);
  }
  const root = evaluated.find((item) => item.layer.id === rootId);
  if (!root) return undefined;
  let result: Bounds2D | undefined;
  const visit = (item: EvaluatedNode): void => {
    if (item.visible && (!drawableOnly || isDrawableNode(item))) result = unionBounds(result, item.worldBounds);
    for (const child of byParent.get(item.layer.id) ?? []) visit(child);
  };
  visit(root);
  return result;
}

/** Approximate run hit-test along node width for click-to-edit SourceRef mapping. */
export function hitTestTextRun(
  item: EvaluatedNode,
  point: Point2D,
  runs: Array<{ id: string; text: string }>,
): { runId: string; sourceRef: { kind: "text-run"; layerId: string; runId: string } } | null {
  if (item.layer.type !== "text" || !hitTestNode(item, point)) return null;
  if (runs.length === 0) return null;
  const inverse = invertMatrix(item.worldMatrix);
  if (!inverse) return null;
  const local = applyMatrix(inverse, point.x, point.y);
  const total = runs.reduce((sum, run) => sum + Math.max(1, run.text.length), 0);
  let cursor = 0;
  for (const run of runs) {
    const share = Math.max(1, run.text.length) / total;
    const start = cursor * item.transform.width;
    const end = (cursor + share) * item.transform.width;
    cursor += share;
    if (local.x >= start && local.x <= end) {
      return {
        runId: run.id,
        sourceRef: { kind: "text-run", layerId: item.layer.id, runId: run.id },
      };
    }
  }
  return {
    runId: runs[0]!.id,
    sourceRef: { kind: "text-run", layerId: item.layer.id, runId: runs[0]!.id },
  };
}
