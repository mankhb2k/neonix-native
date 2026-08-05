"use client";

import { RemotionPreview } from "@/components/editor/stage/RemotionPreview";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  project: MotionProject;
  width: number;
  height: number;
};

export function StageViewport({ project, width, height }: Props) {
  return (
    <main
      className="editor-area-stage relative flex min-h-0 flex-col items-center justify-center overflow-hidden bg-[var(--stage-bg)] p-4"
      data-testid="editor-stage"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(235,230,220,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(235,230,220,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div
        className="relative z-[1] flex max-h-[82%] w-full max-w-[min(72%,720px)] items-center justify-center"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <RemotionPreview project={project} width={width} height={height} />
      </div>
    </main>
  );
}
