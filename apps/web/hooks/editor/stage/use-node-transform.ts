/**
 * Helpers to start node transform gestures from authoring + world bounds.
 */

import { useCallback } from "react";
import type {
  BeginMoveArgs,
  BeginResizeArgs,
  BeginRotateArgs,
  ResizeHandle,
  StageBounds,
  StagePoint,
  StageTransformValues,
} from "@motionvideo/editor-core";

export type UseNodeTransformArgs = {
  beginMove: (args: BeginMoveArgs) => void;
  beginResize: (args: BeginResizeArgs) => void;
  beginRotate: (args: BeginRotateArgs) => void;
  newInteractionId?: () => string;
};

let interactionSeq = 0;
function defaultInteractionId(): string {
  interactionSeq += 1;
  return `stage-${interactionSeq}`;
}

export function useNodeTransform({
  beginMove,
  beginResize,
  beginRotate,
  newInteractionId = defaultInteractionId,
}: UseNodeTransformArgs) {
  const startMove = useCallback(
    (
      base: StageTransformValues,
      worldBounds: StageBounds,
      pointer: StagePoint,
    ) => {
      beginMove({
        interactionId: newInteractionId(),
        base,
        worldBounds,
        pointer,
      });
    },
    [beginMove, newInteractionId],
  );

  const startResize = useCallback(
    (
      base: StageTransformValues,
      worldBounds: StageBounds,
      handle: ResizeHandle,
      pointer: StagePoint,
    ) => {
      beginResize({
        interactionId: newInteractionId(),
        base,
        worldBounds,
        handle,
        pointer,
      });
    },
    [beginResize, newInteractionId],
  );

  const startRotate = useCallback(
    (
      base: StageTransformValues,
      worldBounds: StageBounds,
      pointer: StagePoint,
    ) => {
      beginRotate({
        interactionId: newInteractionId(),
        base,
        worldBounds,
        pointer,
      });
    },
    [beginRotate, newInteractionId],
  );

  return { startMove, startResize, startRotate };
}
