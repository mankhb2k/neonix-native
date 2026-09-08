import type { EditorCommand, LayerPatch } from "../../document/commands";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";
import {
  buildPlayheadTransformPatches,
  type PlayheadTransformEdit,
  type PlayheadTransformOptions,
} from "./keyframes";

export type StageTransformCommandInput = {
  layers: readonly V2Layer[];
  evaluatedLayers?: readonly V2Layer[];
  timeSeconds: number;
  edit: PlayheadTransformEdit;
  options?: PlayheadTransformOptions;
};

/**
 * Build the canonical document command for a stage transform.
 *
 * The caller supplies the evaluated layer snapshot used for keyframe-aware
 * edits. Command shape and single-vs-group behavior stay in editor-core so
 * browser gesture hosts do not reconstruct document mutations themselves.
 */
export function buildStageTransformCommand(
  input: StageTransformCommandInput,
): EditorCommand | null {
  if (input.layers.length === 0) return null;
  const patches = buildPlayheadTransformPatches(
    input.layers,
    input.evaluatedLayers ?? input.layers,
    input.timeSeconds,
    input.edit,
    input.options,
  );
  const changed = Object.fromEntries(
    Object.entries(patches).filter(([, patch]) => Object.keys(patch as LayerPatch).length > 0),
  );
  const layerIds = Object.keys(changed);
  if (layerIds.length === 0) return null;
  if (layerIds.length === 1) {
    const layerId = layerIds[0]!;
    return { type: "patch-layer", layerId, patch: changed[layerId]! };
  }
  return { type: "patch-layers", patches: changed };
}
