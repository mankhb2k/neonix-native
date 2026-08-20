"use client";

import { PreviewStageHost } from "@/components/editor/stage/PreviewStageHost";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import {
  resolveStageRendererBackend,
  type StageRendererBackend,
} from "@/lib/editor/stage/stage-renderer-factory";
import { stackRootLayersToTimeline } from "@motionvideo/editor-core";
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

export function StageViewport({ project, width, height }: Props) {
  const [mode, setMode] = useState<StageRendererBackend>("preview");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setMode(resolveStageRendererBackend());
  }, []);

  const preview = useMemo(() => resolvePreviewProject(project), [project]);
  const { paintClips, paintLanes } = useMemo(() => {
    const stacked = stackRootLayersToTimeline(preview.project);
    return { paintClips: stacked.clips, paintLanes: stacked.lanes };
  }, [preview.project]);

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
      className="editor-panel flex flex-col overflow-hidden [grid-area:stage]"
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
    </main>
  );
}
