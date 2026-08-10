"use client";

import { PreviewStageHost } from "@/components/editor/stage/PreviewStageHost";
import { TimelineShell } from "@/components/editor/timeline/TimelineShell";
import { useEditorStore } from "@/lib/editor/editor-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { sceneOrderToTimelineClips } from "@motionvideo/editor-core";
import { subscribeLibraryDrag } from "@/lib/editor/library/library-drag-session";
import { isOverStageDropZone } from "@/lib/editor/library/timeline-library-drop";
import { cn } from "@/lib/utils";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { useEffect, useMemo, useState } from "react";

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
  const [dragOver, setDragOver] = useState(false);

  const preview = useMemo(() => resolvePreviewProject(project), [project]);
  const { paintClips, paintLanes } = useMemo(() => {
    if (clips.length > 0) return { paintClips: clips, paintLanes: lanes };
    const derived = sceneOrderToTimelineClips(preview.project);
    return { paintClips: derived.clips, paintLanes: derived.lanes };
  }, [clips, lanes, preview.project]);

  useEffect(() => {
    return subscribeLibraryDrag((session) => {
      if (session.phase !== "dragging") {
        setDragOver(false);
        return;
      }
      setDragOver(isOverStageDropZone(session.clientX, session.clientY));
    });
  }, []);

  return (
    <main
      className="flex min-h-0 min-w-0 flex-col [grid-area:stage]"
      data-testid="editor-stage"
      data-stage-backend={mode}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--stage-bg)] px-4 pt-4 pb-3 transition-colors",
          dragOver && "bg-[var(--accent-soft)]",
        )}
        data-stage-drop-zone="true"
      >
        <div
          className="relative z-[1] flex max-h-full w-full max-w-[min(90%,1080px)] items-center justify-center overflow-hidden rounded-sm bg-[var(--preview-bg)] shadow-lg"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <PreviewStageHost
            project={preview.project}
            clips={paintClips}
            lanes={paintLanes}
          />
        </div>
      </div>

      <div className="flex h-[var(--editor-timeline-h)] max-h-[40%] min-h-[120px] shrink-0 flex-col border-t-2 border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <TimelineShell />
      </div>
    </main>
  );
}
