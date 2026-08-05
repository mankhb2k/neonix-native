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

const BOARD_BG = "#ffffff";

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
      className="relative h-full w-full overflow-hidden bg-[var(--preview-bg)]"
      data-testid="editor-stage-frame"
    >
      <Player
        component={MotionComposition}
        inputProps={{
          runtime,
          sceneId,
          width,
          height,
          background: BOARD_BG,
        }}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={fps}
        style={{ width: "100%", height: "100%", background: BOARD_BG }}
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
        <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-[3] text-center text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]">
          Demo · blank project — click to select
        </p>
      ) : null}
    </div>
  );
}
