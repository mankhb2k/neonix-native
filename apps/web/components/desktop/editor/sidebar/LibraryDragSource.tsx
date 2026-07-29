"use client";

import type { DragEvent, ReactNode } from "react";
import {
  clearDragCursor,
  setDragCursor,
} from "@/lib/editor/drag-cursor";
import { FRAME_LIBRARY_MIME, type FrameDraft } from "@/lib/editor/frame-library";
import { useEditorStore } from "@/lib/editor/editor-store";

const EMPTY_DRAG_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type Props = {
  draft: FrameDraft;
  children: ReactNode;
  className?: string;
};

/** Makes a FrameDraft-compatible library tile draggable onto the timeline. */
export function LibraryDragSource({ draft, children, className }: Props) {
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);

  function onDragStart(event: DragEvent<HTMLDivElement>) {
    const img = new Image();
    img.src = EMPTY_DRAG_IMAGE;
    event.dataTransfer.setDragImage(img, 0, 0);
    event.dataTransfer.setData(FRAME_LIBRARY_MIME, draft.id);
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: draft.id,
        type: "frame",
        name: draft.name,
        duration: draft.duration ?? 5,
      }),
    );
    event.dataTransfer.setData("text/plain", draft.id);
    event.dataTransfer.effectAllowed = "copy";
    setActiveDragItem({
      id: draft.id,
      type: "frame",
      name: draft.name,
      duration: draft.duration ?? 5,
    });
    setIsOverTimeline(false);
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }
  }

  function onDrag(event: DragEvent<HTMLDivElement>) {
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }
  }

  function onDragEnd() {
    setActiveDragItem(null);
    clearDragCursor();
    setIsOverTimeline(false);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      className={className ?? "cursor-grab active:cursor-grabbing"}
    >
      {children}
    </div>
  );
}
