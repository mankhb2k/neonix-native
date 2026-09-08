import { useMemo } from "react";
import type { StageRuntimeSnapshot } from "@/lib/editor/stage/runtime-query";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";

type Input = {
  runtimeSnapshot: StageRuntimeSnapshot;
  selectedLayerIds: readonly string[];
  hiddenLayerIds: readonly string[];
  lockedLayerIds: readonly string[];
};

export type StageSelectionModel = {
  selectedLayers: V2Layer[];
  activeVisualLayers: V2Layer[];
  evaluatedLayersById: ReadonlyMap<string, V2Layer>;
};

/**
 * Builds the stage's evaluated interaction model once per document/playhead
 * snapshot. The overlay consumes this view model instead of sampling runtime
 * layers from event handlers and JSX render paths.
 */
export function useSelectionTool({
  runtimeSnapshot,
  selectedLayerIds,
  hiddenLayerIds,
  lockedLayerIds,
}: Input): StageSelectionModel {
  return useMemo(() => {
    const hiddenIds = new Set(hiddenLayerIds);
    const lockedIds = new Set(lockedLayerIds);
    const { evaluatedLayersById } = runtimeSnapshot;
    const activeVisualLayers = runtimeSnapshot.activeVisualLayers.filter(
      (layer) => !hiddenIds.has(layer.id) && !lockedIds.has(layer.id),
    );

    const selectedLayers = selectedLayerIds
      .map((id) => evaluatedLayersById.get(id))
      .filter((layer): layer is V2Layer => Boolean(layer))
      .filter((layer) => !hiddenIds.has(layer.id) && !lockedIds.has(layer.id));
    return { selectedLayers, activeVisualLayers, evaluatedLayersById };
  }, [hiddenLayerIds, lockedLayerIds, runtimeSnapshot, selectedLayerIds]);
}
