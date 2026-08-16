/**
 * Suy duration timeline từ timing layer gốc:
 * max(start + duration) của root. Timing con không kéo dài duration toàn cục.
 */
import type { LayerV1 } from "../layers";

export function roundTimelineValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function getRootLayerTimelineEndV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  let end = 0;
  for (const layer of layers) {
    if (layer.parentLayerId !== null) continue;
    end = Math.max(end, layer.timing.start + layer.timing.duration);
  }
  return roundTimelineValue(end);
}

export function deriveTimelineDurationV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  return getRootLayerTimelineEndV1(layers);
}

export function hasTimelineContentV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): boolean {
  return layers.some((layer) => layer.parentLayerId === null);
}
