"use client";

import { PreviewStageHost } from "@/components/editor/stage/PreviewStageHost";
import { MinimalTimeline } from "@/components/editor/timeline/MinimalTimeline";
import { useEditorStore } from "@/lib/editor/editor-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { sceneOrderToTimelineClips } from "@/lib/editor/timeline/scene-order-clips";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useMemo } from "react";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

/** Pixi is the only production preview engine (DOM available for debug). */
function resolveStageMode(): "dom" | "pixi" {
  const raw = process.env.NEXT_PUBLIC_STAGE_RENDERER?.toLowerCase();
  if (raw === "dom") return "dom";
  return "pixi";
}

export function StageViewport({ project, width, height }: Props) {
  const clips = useEditorStore((s) => s.timelineClips);
  const lanes = useEditorStore((s) => s.timelineLanes);
  const mode = resolveStageMode();

  const preview = useMemo(() => resolvePreviewProject(project), [project]);
  const { paintClips, paintLanes } = useMemo(() => {
    if (clips.length > 0) return { paintClips: clips, paintLanes: lanes };
    const derived = sceneOrderToTimelineClips(preview.project);
    return { paintClips: derived.clips, paintLanes: derived.lanes };
  }, [clips, lanes, preview.project]);

  return (
    <main
      className="editor-area-stage"
      data-testid="editor-stage"
      data-stage-backend={mode}
    >
      <div className="editor-stage-canvas editor-stage-workspace">
        <div
          className="editor-stage-board"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <PreviewStageHost
            project={preview.project}
            clips={paintClips}
            lanes={paintLanes}
          />
        </div>
      </div>

      <div className="editor-stage-timeline">
        <MinimalTimeline />
      </div>
    </main>
  );
}
