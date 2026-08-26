"use client";

import { useEffect, useState } from "react";
import {
  getLibraryDragSession,
  subscribeLibraryDrag,
  type LibraryDragSessionState,
} from "@/lib/editor/library/library-drag-session";
import {
  getTimelineLibraryDropHost,
  isOverTimelineDropZone,
  resolveLibraryDropGhost,
  type LibraryDropGhost,
} from "@/lib/editor/library/timeline-library-drop";
import { clipStripHeightPx, SECONDARY_LANE_HEIGHT_PX } from "../timeline-scale";
import {
  TimelineClipFloat,
  visualKindFromTrack,
} from "./TimelineClipFloat";

type Props = {
  /** Full scroll-content width for the insert indicator line. */
  contentWidth: number;
};

function sampleGhost(session: LibraryDragSessionState): LibraryDropGhost | null {
  if (session.phase !== "dragging" || !session.item) return null;
  return resolveLibraryDropGhost(
    session.clientX,
    session.clientY,
    session.item,
  );
}

type FloatPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Library → timeline: gray **ghost** at drop target + colored **float** on the pointer.
 */
function floatPlacement(
  session: LibraryDragSessionState,
  ghost: LibraryDropGhost | null,
): FloatPlacement {
  const height = clipStripHeightPx(
    ghost?.ghostHeightPx ?? SECONDARY_LANE_HEIGHT_PX,
  );
  const width = ghost?.widthPx ?? 96;
  const top = session.clientY - height / 2;
  const dropHost = getTimelineLibraryDropHost();
  if (ghost?.valid && dropHost) {
    const rect = dropHost.scrollEl.getBoundingClientRect();
    return {
      left: rect.left + ghost.contentLeft - dropHost.scrollEl.scrollLeft,
      top,
      width,
      height,
    };
  }
  return {
    left: session.clientX - width / 2,
    top,
    width,
    height,
  };
}

export function LibraryDropGhostOverlay({ contentWidth }: Props) {
  const [session, setSession] = useState<LibraryDragSessionState>(
    getLibraryDragSession,
  );
  const [ghost, setGhost] = useState<LibraryDropGhost | null>(null);
  const [overTimeline, setOverTimeline] = useState(false);
  const [float, setFloat] = useState<FloatPlacement>(() =>
    floatPlacement(getLibraryDragSession(), null),
  );

  useEffect(() => {
    let scrollEl: HTMLElement | null = null;

    const refresh = (next: LibraryDragSessionState) => {
      const nextGhost = sampleGhost(next);
      setSession(next);
      setGhost(nextGhost);
      setOverTimeline(
        next.phase === "dragging" &&
          isOverTimelineDropZone(next.clientX, next.clientY),
      );
      setFloat(floatPlacement(next, nextGhost));
    };

    const onScroll = () => refresh(getLibraryDragSession());

    const unbindScroll = () => {
      scrollEl?.removeEventListener("scroll", onScroll);
      scrollEl = null;
    };

    const bindScrollIfNeeded = (next: LibraryDragSessionState) => {
      if (next.phase !== "dragging") {
        unbindScroll();
        return;
      }
      const hostEl = getTimelineLibraryDropHost()?.scrollEl ?? null;
      if (hostEl === scrollEl) return;
      unbindScroll();
      scrollEl = hostEl;
      // The target is dynamic; unbindScroll removes the same listener before replacement/unmount.
      // eslint-disable-next-line react-web-api/no-leaked-event-listener
      scrollEl?.addEventListener("scroll", onScroll);
    };

    const unsub = subscribeLibraryDrag((next) => {
      bindScrollIfNeeded(next);
      refresh(next);
    });

    return () => {
      unsub();
      unbindScroll();
    };
  }, []);

  const dragging = session.phase === "dragging" && session.item != null;
  const floatKind = visualKindFromTrack(
    ghost?.track === "audio"
      ? "audio"
      : ghost?.track === "main"
        ? "main"
        : "overlay",
  );

  return (
    <>
      {ghost?.valid && ghost.isInsert ? (
        <>
          <div
            className="pointer-events-none absolute z-[35] h-8 -translate-y-1/2 rounded-md border border-[var(--border-strong)] bg-[var(--fg-primary)]/18 shadow-sm"
            style={{
              left: ghost.contentLeft,
              top: ghost.contentTop,
              width: ghost.widthPx,
            }}
            data-testid="library-drop-ghost"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute z-[35] h-px bg-[var(--accent)]"
            style={{
              left: 0,
              top: ghost.contentTop,
              width: Math.max(contentWidth, ghost.contentLeft + ghost.widthPx),
            }}
            data-testid="timeline-insert-indicator"
            aria-hidden
          />
        </>
      ) : null}
      {ghost?.valid && !ghost.isInsert ? (
        <div
          className="pointer-events-none absolute z-[35] -translate-y-1/2 rounded-md border border-[var(--border-strong)] bg-[var(--fg-primary)]/18"
          style={{
            left: ghost.contentLeft,
            top: ghost.contentTop,
            width: ghost.widthPx,
            height: ghost.ghostHeightPx,
          }}
          data-testid="library-drop-ghost"
          aria-hidden
        />
      ) : null}
      {dragging && overTimeline ? (
        <TimelineClipFloat
          visualKind={floatKind}
          label={session.item?.label ?? ""}
          left={float.left}
          top={float.top}
          width={float.width}
          height={float.height}
          valid={ghost?.valid !== false}
        />
      ) : null}
    </>
  );
}
