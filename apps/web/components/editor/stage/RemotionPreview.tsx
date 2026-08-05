"use client";

import { Player } from "@remotion/player";
import {
  compositionDurationInFrames,
  MotionComposition,
} from "@motionvideo/remotion-renderer";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import type { MotionProject } from "@motionvideo/motion-schema";
import { InteractionOverlay } from "@/components/editor/stage/InteractionOverlay";
import {
  buildPreviewSnapshot,
  resolvePreviewProject,
} from "@/lib/editor/preview/preview-project";
import { useMemo } from "react";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

export function RemotionPreview({ project, width, height }: Props) {
  const { runtime, sceneId, fps, usingDemo, snapshot } = useMemo(() => {
    const preview = resolvePreviewProject(project);
    const compiled = compileMotionProject(preview.project);
    const id =
      compiled.timeline.sceneOrder[0] ??
      compiled.scenes[0]?.id ??
      preview.sceneId;
    return {
      runtime: compiled,
      sceneId: id,
      fps: compiled.metadata.fps || 30,
      usingDemo: preview.usingDemo,
      snapshot: buildPreviewSnapshot(project, 0, 0),
    };
  }, [project]);

  const durationInFrames = useMemo(
    () => compositionDurationInFrames(runtime, sceneId, fps),
    [runtime, sceneId, fps],
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[#0a0908] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      data-testid="editor-stage-frame"
    >
      <Player
        component={MotionComposition}
        inputProps={{
          runtime,
          sceneId,
          width,
          height,
          background: "#0c0b0a",
        }}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={fps}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
      />
      <InteractionOverlay
        snapshot={snapshot}
        compositionWidth={width}
        compositionHeight={height}
      />
      {usingDemo ? (
        <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-[3] text-center text-[10px] uppercase tracking-[0.12em] text-[var(--accent-text)]">
          Demo fixture · blank project — click to select (PR3)
        </p>
      ) : null}
    </div>
  );
}
