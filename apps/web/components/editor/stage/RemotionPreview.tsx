"use client";

import { Player } from "@remotion/player";
import {
  compositionDurationInFrames,
  createDemoMotionProject,
  DEMO_SCENE_ID,
  MotionComposition,
} from "@motionvideo/remotion-renderer";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useMemo } from "react";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

export function RemotionPreview({ project, width, height }: Props) {
  const { runtime, sceneId, fps, usingDemo } = useMemo(() => {
    const hasScenes = project.scenes.length > 0;
    const source = hasScenes ? project : createDemoMotionProject();
    const compiled = compileMotionProject(source);
    const id = compiled.timeline.sceneOrder[0] ?? compiled.scenes[0]?.id ?? DEMO_SCENE_ID;
    return {
      runtime: compiled,
      sceneId: id,
      fps: compiled.metadata.fps || 30,
      usingDemo: !hasScenes,
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
        controls
        clickToPlay={false}
        doubleClickToFullscreen={false}
      />
      {usingDemo ? (
        <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--accent-text)]">
          Demo fixture · blank project — Remotion snapshot path (PR2)
        </p>
      ) : null}
    </div>
  );
}
