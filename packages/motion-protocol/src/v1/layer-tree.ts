/**
 * Helpers cho cây layer lồng.
 */
import type { LayerV1 } from "./layers";

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
