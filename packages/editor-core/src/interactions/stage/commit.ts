/** Convert a stage preview into the canonical Protocol V2 document command. */

import type { EditorCommand, LayerPatch } from "../../document/commands";
import type { StageTransformValues } from "./transform-box";

export type StageLayerPatch = {
  layerId: string;
  values: StageTransformValues;
  patch: LayerPatch;
};

export type StageCommitResult = {
  interactionId: string;
  mode: "move" | "resize" | "rotate";
  patches: StageLayerPatch[];
  command: EditorCommand | null;
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function layerPatchFromPreview(
  base: StageTransformValues,
  preview: StageTransformValues,
): LayerPatch {
  const patch: LayerPatch = {};
  const translate = {
    x: finiteOr(preview.x, base.x),
    y: finiteOr(preview.y, base.y),
  };
  const rotate = { z: finiteOr(preview.rotation, base.rotation) };

  if (preview.x !== base.x || preview.y !== base.y) {
    patch.transform = { translate };
  }
  if (preview.rotation !== base.rotation) {
    patch.transform = { ...(patch.transform ?? {}), rotate };
  }
  if (preview.width !== base.width || preview.height !== base.height) {
    patch.frame = {
      width: Math.max(0.001, finiteOr(preview.width, base.width)),
      height: Math.max(0.001, finiteOr(preview.height, base.height)),
    };
  }
  return patch;
}

export function toStageLayerPatches(
  base: StageTransformValues,
  preview: StageTransformValues,
): StageLayerPatch[] {
  return [
    {
      layerId: preview.layerId,
      values: preview,
      patch: layerPatchFromPreview(base, preview),
    },
  ];
}

/** Build one atomic command, or a patch-layers command for a group gesture. */
export function toStageDocumentCommand(
  patches: readonly StageLayerPatch[],
): EditorCommand | null {
  const changed = patches.filter((patch) => Object.keys(patch.patch).length > 0);
  if (changed.length === 0) return null;
  if (changed.length === 1) {
    const patch = changed[0]!;
    return { type: "patch-layer", layerId: patch.layerId, patch: patch.patch };
  }
  return {
    type: "patch-layers",
    patches: Object.fromEntries(
      changed.map((patch) => [patch.layerId, patch.patch]),
    ),
  };
}
