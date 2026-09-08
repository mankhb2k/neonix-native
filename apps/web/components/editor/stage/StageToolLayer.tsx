"use client";

import { TextEditTool, type TextEditOverlayHandle } from "./tools/text";
import { TransformTool } from "./tools/transform/TransformTool";
import type { StageRuntimeSnapshot } from "@/lib/editor/stage/runtime-query";
import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";
import type { MutableRefObject } from "react";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  runtimeSnapshot: StageRuntimeSnapshot;
  textEditFrameRef: MutableRefObject<RuntimeFrameV3 | null>;
  textEditOverlayRef: MutableRefObject<TextEditOverlayHandle | null>;
};

/** Composes DOM-only stage tools above the authoritative playback renderer. */
export function StageToolLayer({
  compositionWidth,
  compositionHeight,
  runtimeSnapshot,
  textEditFrameRef,
  textEditOverlayRef,
}: Props) {
  const activeLayerIds = runtimeSnapshot.activeVisualLayers.map((layer) => layer.id).join(",");

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="stage-runtime-snapshot"
        data-document-id={runtimeSnapshot.documentId}
        data-time={runtimeSnapshot.timeSeconds}
        data-active-layer-ids={activeLayerIds}
        hidden
      />
      <TextEditTool
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        runtimeSnapshot={runtimeSnapshot}
        frameRef={textEditFrameRef}
        overlayRef={textEditOverlayRef}
      />
      <TransformTool
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        runtimeSnapshot={runtimeSnapshot}
      />
    </>
  );
}
