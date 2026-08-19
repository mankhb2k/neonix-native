/**
 * Suy độ dài project từ timing layer gốc:
 * max(start + duration) của root. Timing con không kéo dài duration toàn cục.
 * Authoring JSON không ghi duration — compiler stamp runtime.timeline.duration.
 */
import type { LayerV1 } from "./index";

export function roundProjectDurationValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function getRootLayerEndV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  let end = 0;
  for (const layer of layers) {
    if (layer.parentLayerId !== null) continue;
    end = Math.max(end, layer.timing.start + layer.timing.duration);
  }
  return roundProjectDurationValue(end);
}

export function deriveProjectDurationV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  return getRootLayerEndV1(layers);
}

export function hasRootLayersV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): boolean {
  return layers.some((layer) => layer.parentLayerId === null);
}
