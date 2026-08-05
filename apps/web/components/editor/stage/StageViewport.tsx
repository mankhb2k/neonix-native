"use client";

import { PreviewStageHost } from "@/components/editor/stage/PreviewStageHost";
import { MinimalTimeline } from "@/components/editor/timeline/MinimalTimeline";
import { useEditorStore } from "@/lib/editor/editor-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { sceneOrderToTimelineClips } from "@/lib/editor/timeline/scene-order-clips";
import type { MotionProject } from "@motionvideo/motion-schema";
import dynamic from "next/dynamic";
import { useMemo } from "react";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

/**
 * Stage renderer selection (P7):
 * - pixi (default): PreviewStageHost + PixiStageRenderer
 * - dom: PreviewStageHost + DOM painter
 * - remotion: optional fallback Player (one-release internal)
 */
function resolveStageMode(): "remotion" | "dom" | "pixi" {
  const raw = process.env.NEXT_PUBLIC_STAGE_RENDERER?.toLowerCase();
  if (raw === "remotion") return "remotion";
  if (raw === "dom") return "dom";
  return "pixi";
}

const RemotionPreview = dynamic(
  () =>
    import("@/components/editor/stage/RemotionPreview").then(
      (mod) => mod.RemotionPreview,
    ),
  { ssr: false },
);

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
          {mode === "remotion" ? (
            <RemotionPreview project={project} width={width} height={height} />
          ) : (
            <PreviewStageHost
              project={preview.project}
              clips={paintClips}
              lanes={paintLanes}
            />
          )}
        </div>
      </div>

      <div className="editor-stage-timeline">
        <MinimalTimeline />
      </div>
    </main>
  );
}
