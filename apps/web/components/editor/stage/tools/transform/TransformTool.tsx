"use client";

import { SelectionTool } from "../selection/SelectionTool";
import { useTransformTool } from "./use-transform-tool";
import type { StageRuntimeSnapshot } from "@/lib/editor/stage/runtime-query";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  runtimeSnapshot: StageRuntimeSnapshot;
};

/** DOM composition for the stage transform controller and its selection chrome. */
export function TransformTool({ compositionWidth, compositionHeight, runtimeSnapshot }: Props) {
  const stage = useTransformTool({ compositionWidth, compositionHeight, runtimeSnapshot });

  return (
    <SelectionTool
      overlayRef={stage.overlayRef}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      activeVisualLayers={stage.activeVisualLayers}
      selectedLayers={stage.selectedLayers}
      selectedBounds={stage.selectedBounds}
      snapGuides={stage.snapGuides}
      textEditLayerId={stage.textEditLayerId}
      onMovePointerDown={stage.onMovePointerDown}
      onTextDoubleClick={stage.onTextDoubleClick}
      onResizePointerDown={stage.onResizePointerDown}
      onRotatePointerDown={stage.onRotatePointerDown}
      onTransformPointerMove={stage.onTransformPointerMove}
      onTransformPointerUp={stage.onTransformPointerUp}
      onCancelMove={stage.onCancelMove}
      onBackgroundPointerDown={stage.onBackgroundPointerDown}
    />
  );
}
