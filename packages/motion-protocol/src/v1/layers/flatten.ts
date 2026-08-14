/**
 * Duỗi cây layer lồng thành danh sách pre-order.
 *
 * JSON lồng (group.children) là nguồn sự thật; helper cho validate, duration, compiler.
 */
import type { LayerV1 } from "./index";

export function flattenLayerTree(layers: readonly LayerV1[]): LayerV1[] {
  const out: LayerV1[] = [];
  const walk = (nodes: readonly LayerV1[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.type === "group" && (node.children?.length ?? 0) > 0) {
        walk(node.children);
      }
    }
  };
  walk(layers);
  return out;
}

export function isProjectRootLayer(layer: LayerV1): boolean {
  return layer.parentLayerId === null;
}

export function getRootLayers(layers: readonly LayerV1[]): LayerV1[] {
  return layers.filter(isProjectRootLayer);
}
