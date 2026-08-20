"use client";

import { subscribeLibraryDrag } from "@/lib/editor/library/library-drag-session";
import { isOverStageDropZone } from "@/lib/editor/library/timeline-library-drop";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  project: unknown;
  width: number;
  height: number;
};

/**
 * The old authoring editor cannot produce Atomic Protocol V2 yet. Keep its
 * stage visibly disabled so it cannot silently execute the V1 preview path.
 * The certified V2 surface is `/docs/preview` until authoring migration lands.
 */
export function StageViewport({ width, height }: Props) {
  const [dragOver, setDragOver] = useState(false);

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
      data-stage-backend="disabled-v1"
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
          data-testid="editor-stage-v1-disabled"
        >
          <a
            className="text-sm text-[var(--fg-muted)] underline underline-offset-4"
            href="/docs/preview"
          >
            Open Protocol V2 preview
          </a>
        </div>
      </div>
    </main>
  );
}
