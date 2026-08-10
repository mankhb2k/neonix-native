"use client";

import { useEffect, useState } from "react";
import {
  getLibraryDragSession,
  subscribeLibraryDrag,
  type LibraryDragSessionState,
} from "@/lib/editor/library/library-drag-session";
import {
  getTimelineLibraryDropHost,
  resolveLibraryDropGhost,
  type LibraryDropGhost,
} from "@/lib/editor/library/timeline-library-drop";

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

/**
 * Gray drop ghost + teal insert-lane line (CapCut / desktop parity).
 */
export function LibraryDropGhostOverlay({ contentWidth }: Props) {
  const [ghost, setGhost] = useState<LibraryDropGhost | null>(null);

  useEffect(() => {
    let scrollEl: HTMLElement | null = null;

    const refresh = () => {
      setGhost(sampleGhost(getLibraryDragSession()));
    };

    const onScroll = () => refresh();

    const unbindScroll = () => {
      scrollEl?.removeEventListener("scroll", onScroll);
      scrollEl = null;
    };

    const bindScrollIfNeeded = (session: LibraryDragSessionState) => {
      if (session.phase !== "dragging") {
        unbindScroll();
        return;
      }
      const next = getTimelineLibraryDropHost()?.scrollEl ?? null;
      if (next === scrollEl) return;
      unbindScroll();
      scrollEl = next;
      scrollEl?.addEventListener("scroll", onScroll, { passive: true });
    };

    const unsub = subscribeLibraryDrag((session) => {
      bindScrollIfNeeded(session);
      setGhost(sampleGhost(session));
    });

    return () => {
      unsub();
      unbindScroll();
    };
  }, []);

  if (!ghost?.valid) return null;

  const lineWidth = Math.max(contentWidth, ghost.contentLeft + ghost.widthPx);

  if (ghost.isInsert) {
    return (
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
            width: lineWidth,
          }}
          data-testid="timeline-insert-indicator"
          aria-hidden
        />
      </>
    );
  }

  return (
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
  );
}
