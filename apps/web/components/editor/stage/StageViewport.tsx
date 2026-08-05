"use client";

import { RemotionPreview } from "@/components/editor/stage/RemotionPreview";
import { MinimalTimeline } from "@/components/editor/timeline/MinimalTimeline";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

export function StageViewport({ project, width, height }: Props) {
  return (
    <main className="editor-area-stage" data-testid="editor-stage">
      <div className="editor-stage-canvas editor-stage-workspace">
        <div
          className="editor-stage-board"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <RemotionPreview project={project} width={width} height={height} />
        </div>
      </div>

      <div className="editor-stage-timeline">
        <MinimalTimeline />
      </div>
    </main>
  );
}
