import { Film, Music, Plus } from "lucide-react";
import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import { useEffect, useState } from "react";
import { getTimelineDropHost } from "../../timeline/drop/timeline-drop-host";
import { hitTimelineDropZone } from "../../timeline/drop/drop-geometry";
import {
  getSession,
  subscribe,
  type LibraryDragSessionState,
} from "../interactions/library-drag-session";
import type { LibraryPayload } from "../model/library-payload";

/** Square CapCut card outside timeline: 68px x 68px → center on cursor */
const CARD_ANCHOR_X = 34;
const CARD_ANCHOR_Y = 34;
/** Cyan on timeline: h-8 → left edge on cursor, vertically centered. */
const CYAN_ANCHOR_X = 0;
const CYAN_ANCHOR_Y = 16;

function renderDragItemPreview(item: LibraryPayload) {
  if (item.kind === "shape") {
    if (item.shape === "rectangle") {
      return (
        <div className="h-9 w-9 border-2 border-white bg-transparent rounded-sm" />
      );
    }
    if (item.shape === "ellipse") {
      return (
        <div className="h-9 w-9 border-2 border-white bg-transparent rounded-full" />
      );
    }
    if (item.label.includes("tam giác") || item.label.includes("Triangle")) {
      return (
        <svg
          className="h-9 w-9 fill-none stroke-white stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 22.5,22.5 1.5,22.5" strokeLinejoin="round" />
        </svg>
      );
    }
    if (item.label.includes("ngôi sao") || item.label.includes("Star")) {
      return (
        <svg
          className="h-9 w-9 fill-none stroke-white stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon
            points="12,1.5 15,9 22.5,12 15,15 12,22.5 9,15 1.5,12 9,9"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (item.label.includes("mũi tên") || item.label.includes("Arrow")) {
      return (
        <svg
          className="h-9 w-9 fill-none stroke-white stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon
            points="1.5,8 13.5,8 13.5,2.5 22.5,12 13.5,21.5 13.5,16 1.5,16"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    return (
      <svg
        className="h-9 w-9 fill-none stroke-white stroke-2"
        viewBox="0 0 24 24"
      >
        <polygon
          points="12,1.5 22.5,9 18.5,22.5 5.5,22.5 1.5,9"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (item.kind === "text") {
    return (
      <span className="max-w-[56px] truncate text-center text-[14px] font-extrabold text-white tracking-wide drop-shadow-md">
        {item.text || item.label}
      </span>
    );
  }

  if ((item.kind === "image" || item.kind === "video") && item.uri) {
    return (
      <img
        src={item.uri}
        alt={item.label}
        className="h-full w-full object-cover rounded-md"
      />
    );
  }

  if (item.kind === "audio") {
    return <Music size={26} className="text-teal-400" />;
  }

  return <Film size={26} className="text-cyan-400" />;
}

/**
 * Floating library drag chrome — CapCut style square card outside timeline;
 * cyan border + item preview inside.
 */
export function LibraryDragPreview() {
  const [session, setSession] = useState<LibraryDragSessionState>(() =>
    getSession(),
  );

  useEffect(() => subscribe(setSession), []);

  if (session.phase !== "dragging" || !session.item) return null;

  const left = session.clientX - CARD_ANCHOR_X;
  const top = session.clientY - CARD_ANCHOR_Y;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform"
      style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}
      aria-hidden
    >
      {/* CapCut Square Floating Card Bubble */}
      <div className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-xl border-2 border-[#22d3ee] bg-[#27272a] p-2 text-white shadow-2xl backdrop-blur-md">
        {renderDragItemPreview(session.item)}

        {/* Small plus badge at bottom-right corner */}
        <div className="absolute bottom-1 right-1 flex items-center justify-center rounded-full bg-cyan-500/90 p-0.5 text-zinc-950 shadow">
          <Plus size={9} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}
