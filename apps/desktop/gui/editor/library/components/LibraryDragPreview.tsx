import { Film, Music } from "lucide-react";
import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import { useEffect, useState } from "react";
import { getTimelineDropHost } from "../../timeline/drop/timeline-drop-host";
import { hitTimelineDropZone } from "../../timeline/drop/drop-geometry";
import {
  getSession,
  subscribe,
  type LibraryDragSessionState,
} from "../interactions/library-drag-session";

/** Card outside timeline: w-32 h-20 → center on cursor (web GlobalDragPreview). */
const CARD_ANCHOR_X = 64;
const CARD_ANCHOR_Y = 40;
/** Cyan on timeline: h-8 → left edge on cursor, vertically centered. */
const CYAN_ANCHOR_X = 0;
const CYAN_ANCHOR_Y = 16;

/**
 * Floating library drag chrome — card outside timeline; teal bar + gray track
 * ghost when over timeline (web CapCut parity).
 */
export function LibraryDragPreview() {
  const [session, setSession] = useState<LibraryDragSessionState>(() =>
    getSession(),
  );

  useEffect(() => subscribe(setSession), []);

  if (session.phase !== "dragging" || !session.item) return null;

  const overTimeline = hitTimelineDropZone(session.clientX, session.clientY);
  const showTeal = overTimeline;

  const host = getTimelineDropHost();
  const pps = host?.pixelsPerSecond ?? 50;
  const duration =
    "duration" in session.item && typeof session.item.duration === "number"
      ? Math.max(0.5, session.item.duration)
      : DEFAULT_FRAME_DURATION;
  const blockWidth = Math.max(duration * pps, 24);
  const isAudio = session.item.kind === "audio";

  const left = showTeal
    ? session.clientX - CYAN_ANCHOR_X
    : session.clientX - CARD_ANCHOR_X;
  const top = showTeal
    ? session.clientY - CYAN_ANCHOR_Y
    : session.clientY - CARD_ANCHOR_Y;

  return (
    <div
      className={`pointer-events-none fixed top-0 left-0 will-change-transform ${
        showTeal ? "z-[35]" : "z-[9999]"
      }`}
      style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}
      aria-hidden
    >
      {/* Card — only outside timeline */}
      <div
        className={`flex h-20 w-32 flex-col justify-between overflow-hidden rounded-lg border border-[#3f3f46] bg-[#18181b] p-2.5 text-white opacity-95 shadow-2xl backdrop-blur-sm ${
          showTeal ? "hidden" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {isAudio ? (
            <Music size={14} className="shrink-0 text-teal-400" />
          ) : (
            <Film size={14} className="shrink-0 text-cyan-400" />
          )}
          <span className="truncate text-[11px] font-semibold text-zinc-100">
            {session.item.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">
            {session.item.kind}
          </span>
          <span className="rounded border border-white/10 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-200">
            {Math.round(duration)}s
          </span>
        </div>
      </div>

      {/* Teal bar — over timeline; sits on top of gray track ghost */}
      <div
        className={`flex h-8 items-center overflow-hidden rounded border border-[#14B8A6]/40 bg-[#0D7476] px-2.5 text-[11px] font-semibold text-white opacity-95 shadow-2xl ${
          showTeal ? "" : "hidden"
        }`}
        style={{ width: blockWidth }}
      >
        <span className="truncate">{session.item.label}</span>
      </div>
    </div>
  );
}
