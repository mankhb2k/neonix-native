"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getLibraryDragSession,
  subscribeLibraryDrag,
  type LibraryDragSessionState,
} from "@/lib/editor/library/library-drag-session";
import type { LibraryPayload } from "@/lib/editor/library/library-payload";
import { isOverTimelineDropZone } from "@/lib/editor/library/timeline-library-drop";

const CARD_ANCHOR_X = 34;
const CARD_ANCHOR_Y = 34;

function renderDragItemPreview(item: LibraryPayload) {
  if (item.kind === "asset") {
    if (item.asset.kind === "image" || item.asset.kind === "video") {
      return <img src={item.asset.uri} alt="" className="h-full w-full object-cover" />;
    }
    return <span className="text-2xl">♪</span>;
  }
  if (item.kind === "shape") {
    if (item.shape === "ellipse") {
      return (
        <div className="h-9 w-9 rounded-full border-2 border-white bg-transparent" />
      );
    }
    if (item.shape === "polygon") {
      return (
        <svg
          className="h-9 w-9 fill-none stroke-white stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 22.5,22.5 1.5,22.5" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <div className="h-9 w-9 rounded-sm border-2 border-white bg-transparent" />
    );
  }

  return (
    <span className="max-w-[56px] truncate text-center text-[14px] font-extrabold tracking-wide text-white drop-shadow-md">
      {item.text || item.label}
    </span>
  );
}

/**
 * CapCut-style floating library bubble — follows cursor while dragging.
 */
export function LibraryDragPreview() {
  const [session, setSession] = useState<LibraryDragSessionState>(() =>
    getLibraryDragSession(),
  );
  const [overTimeline, setOverTimeline] = useState(false);

  useEffect(
    () =>
      subscribeLibraryDrag((next) => {
        setSession(next);
        setOverTimeline(
          next.phase === "dragging" &&
            isOverTimelineDropZone(next.clientX, next.clientY),
        );
      }),
    [],
  );

  if (session.phase !== "dragging" || !session.item || overTimeline) return null;

  const left = session.clientX - CARD_ANCHOR_X;
  const top = session.clientY - CARD_ANCHOR_Y;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform"
      style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}
      aria-hidden
      data-testid="library-drag-preview"
    >
      <div className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--accent)] bg-[var(--fg-primary)] p-2 text-white shadow-2xl">
        {renderDragItemPreview(session.item)}
        <div className="absolute right-1 bottom-1 flex items-center justify-center rounded-full bg-[var(--accent)] p-0.5 text-[var(--accent-on)] shadow">
          <Plus size={9} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}
