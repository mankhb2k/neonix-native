import {
  isV2LayerActiveAtTime,
  isV2VisualLayer,
} from "@motionvideo/editor-core/interactions/stage";
import { sampleEditorLayerAtTime } from "@motionvideo/editor-runtime";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";

export type StageRuntimeSnapshot = {
  documentId: string;
  timeSeconds: number;
  evaluatedLayersById: ReadonlyMap<string, V2Layer>;
  activeVisualLayers: readonly V2Layer[];
};

/**
 * Browser adapter for authoring-time layer queries used by stage interaction.
 *
 * The stage UI must not import editor-runtime directly. This boundary keeps
 * the current sampling implementation explicit while the canonical query
 * contract is moved out of the UI in a later isolation phase.
 */
export function sampleStageLayerAtTime(layer: V2Layer, timeSeconds: number): V2Layer {
  return sampleEditorLayerAtTime(layer, timeSeconds);
}

/** Canonical evaluated layer snapshot for stage interaction tools. */
export function evaluateStageLayersAtTime(
  document: Pick<MotionProtocolV2, "id" | "layers">,
  timeSeconds: number,
): StageRuntimeSnapshot {
  const evaluatedLayersById = new Map<string, V2Layer>();
  const activeVisualLayers: V2Layer[] = [];
  for (const layer of document.layers) {
    if (!isV2VisualLayer(layer) || !isV2LayerActiveAtTime(layer, timeSeconds)) continue;
    const evaluated = sampleStageLayerAtTime(layer, timeSeconds);
    evaluatedLayersById.set(layer.id, evaluated);
    activeVisualLayers.push(evaluated);
  }
  activeVisualLayers.sort((left, right) => left.order - right.order);
  return {
    documentId: document.id,
    timeSeconds,
    evaluatedLayersById,
    activeVisualLayers,
  };
}
