"use client";

import { PreviewStage } from "@/components/docs/PreviewStage";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { StageTransformOverlay } from "./StageTransformOverlay";

/** Existing editor stage chrome backed by the Protocol V2 preview pipeline. */
export function V2StageViewport() {
  const { document, currentTime, isPlaying } = useEditorSurface();
  return (
    <main
      className="editor-panel flex flex-col overflow-hidden [grid-area:stage]"
      data-testid="editor-stage"
      data-stage-backend="v2"
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--stage-bg)] px-4 pt-4 pb-3">
        <div
          className="relative z-[1] flex max-h-full w-full max-w-[min(90%,1080px)] items-center justify-center overflow-hidden rounded-sm bg-[var(--preview-bg)] shadow-lg"
          style={{ aspectRatio: `${document.composition.width} / ${document.composition.height}` }}
        >
          <PreviewStage
            project={document}
            time={currentTime}
            isPlaying={isPlaying}
          />
          <StageTransformOverlay
            compositionWidth={document.composition.width}
            compositionHeight={document.composition.height}
          />
        </div>
      </div>
    </main>
  );
}
