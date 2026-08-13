/**
 * Flatten a nested authoring layer tree into a pre-order list.
 * Nested JSON (`group.children`) is the source of truth; this helper is
 * for validation, duration, and the compiler adapter.
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
