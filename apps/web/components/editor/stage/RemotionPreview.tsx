"use client";

import {
  MotionComposition,
  Player,
  type PlayerRef,
} from "@motionvideo/remotion-renderer";
import {
  compositionDurationInFrames,
  timelineTotalDuration,
} from "@motionvideo/preview-kit";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import type { MotionProject } from "@motionvideo/motion-schema";
import { InteractionOverlay } from "@/components/editor/stage/InteractionOverlay";
import {
  buildPreviewSnapshot,
  resolvePreviewProject,
} from "@/lib/editor/preview/preview-project";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

const BOARD_BG = "#ffffff";

/** @deprecated P7 fallback — prefer Pixi (`NEXT_PUBLIC_STAGE_RENDERER=pixi`). */
export function RemotionPreview({ project, width, height }: Props) {
  const playerRef = useRef<PlayerRef>(null);
  const currentTime = usePlaybackClock((s) => s.currentTime);
  const seekRevision = usePlaybackClock((s) => s.seekRevision);
  const mode = usePlaybackClock((s) => s.mode);
  const resetClock = usePlaybackClock((s) => s.reset);
  const setDuration = usePlaybackClock((s) => s.setDuration);

  const { runtime, fps, usingDemo, totalDuration } = useMemo(() => {
    const preview = resolvePreviewProject(project);
    const compiled = compileMotionProject(preview.project);
    return {
      runtime: compiled,
      fps: compiled.metadata.fps || 30,
      usingDemo: preview.usingDemo,
      totalDuration: timelineTotalDuration(compiled),
    };
  }, [project]);

  const durationInFrames = useMemo(
    () => compositionDurationInFrames(runtime, undefined, fps),
    [runtime, fps],
  );

  // Keep playback clock aligned with preview project (incl. blank→demo fallback).
  useEffect(() => {
    if (usingDemo) {
      resetClock({ duration: totalDuration, currentTime: 0 });
    } else {
      setDuration(totalDuration);
    }
  }, [usingDemo, totalDuration, resetClock, setDuration, project.metadata.id]);

  const snapshot = useMemo(
    () =>
      buildPreviewSnapshot(
        project,
        currentTime,
        playbackFrameIndex(currentTime, fps),
      ),
    [project, currentTime, fps],
  );

  // Drive Remotion Player from the canonical playback clock (seek-only; no Player play).
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    const frame = Math.max(
      0,
      Math.min(durationInFrames - 1, playbackFrameIndex(currentTime, fps)),
    );
    player.seekTo(frame);
  }, [currentTime, seekRevision, fps, durationInFrames, mode]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[var(--preview-bg)]"
      data-testid="editor-stage-frame"
    >
      <Player
        ref={playerRef}
        component={MotionComposition}
        inputProps={{
          runtime,
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
          Demo · Facebook History — play trên timeline
        </p>
      ) : null}
    </div>
  );
}
