/**
 * Map stage transform preview → property patches / DocumentPropertyCommand.
 */

import type {
  DocumentPropertyCommand,
  NodeTargetRef,
  TransformPatch,
} from "@motionvideo/editor-core";
import type { StageTransformValues } from "./transform-box";

export type StagePropertyPatch = {
  target: NodeTargetRef;
  values: StageTransformValues;
  /** Subset for editor-core set-node-transform today. */
  transformPatch: TransformPatch;
  /** width/height until TransformPatch grows — host may write separately. */
  sizePatch?: { width: number; height: number };
};

export type StageCommitResult = {
  interactionId: string;
  mode: "move" | "resize" | "rotate";
  patches: StagePropertyPatch[];
  command: DocumentPropertyCommand | null;
};

export function toStagePropertyPatches(
  base: StageTransformValues,
  preview: StageTransformValues,
): StagePropertyPatch[] {
  const transformPatch: TransformPatch = {};
  if (preview.x !== base.x) transformPatch.x = preview.x;
  if (preview.y !== base.y) transformPatch.y = preview.y;
  if (preview.rotation !== base.rotation) {
    transformPatch.rotation = preview.rotation;
  }

  const sizeChanged =
    preview.width !== base.width || preview.height !== base.height;

  return [
    {
      target: { sceneId: preview.sceneId, nodeId: preview.nodeId },
      values: preview,
      transformPatch,
      sizePatch: sizeChanged
        ? { width: preview.width, height: preview.height }
        : undefined,
    },
  ];
}

export function toSetNodeTransformCommand(
  patches: StagePropertyPatch[],
): DocumentPropertyCommand | null {
  const withTransform = patches.filter(
    (p) => Object.keys(p.transformPatch).length > 0,
  );
  if (withTransform.length === 0) return null;
  const first = withTransform[0]!;
  return {
    type: "set-node-transform",
    targets: withTransform.map((p) => p.target),
    patch: first.transformPatch,
  };
}
