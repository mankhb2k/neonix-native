"use client";

import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  leftPx: number;
  muted?: boolean;
  onScrubStart?: (clientX: number) => void;
  onScrubMove?: (clientX: number) => void;
  onScrubEnd?: () => void;
};

const HIT_STRIP_WIDTH_PX = 14;
const HANDLE_HEIGHT_PX = 13;
const HANDLE_TOP_PX = 1;
const NEEDLE_TOP_PX = HANDLE_TOP_PX + HANDLE_HEIGHT_PX - 2;

function PlayheadHandleIcon({ muted }: { muted?: boolean }) {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      aria-hidden
      className={
        muted
          ? "text-[var(--fg-disabled)]"
          : "text-[var(--timeline-playhead)]"
      }
    >
      <path d="M0 0h11v7.5L5.5 13 0 7.5V0z" fill="currentColor" />
    </svg>
  );
}

/**
 * CapCut-style playhead: handle + needle share the same center (left:0 + -translate-x-1/2).
 * Hit strip on the needle so scrub works by grabbing the line, not only the icon.
 */
export function Playhead({
  leftPx,
  muted,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
}: Props) {
  const draggingRef = useRef(false);
  const interactive = Boolean(onScrubStart) && !muted;

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      onScrubEnd?.();
    },
    [onScrubEnd],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!interactive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onScrubStart?.(event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    onScrubMove?.(event.clientX);
  };

  const hitClass = interactive
    ? "pointer-events-auto cursor-col-resize touch-none"
    : "pointer-events-none";

  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-30"
      style={{ left: leftPx }}
      data-testid="timeline-playhead"
      data-muted={muted ? "true" : undefined}
    >
      {/* Needle hit strip — grab the line to scrub */}
      <div
        role="slider"
        aria-label="Playhead"
        aria-disabled={muted || !interactive}
        tabIndex={interactive ? 0 : -1}
        className={`absolute bottom-0 -translate-x-1/2 ${hitClass}`}
        style={{
          left: 0,
          top: NEEDLE_TOP_PX,
          width: HIT_STRIP_WIDTH_PX,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />

      {/* Visual needle — centered on time */}
      <div
        className={`pointer-events-none absolute bottom-0 w-px -translate-x-1/2 ${
          muted
            ? "bg-[var(--fg-disabled)]"
            : "bg-[var(--timeline-playhead)]"
        }`}
        style={{ left: 0, top: NEEDLE_TOP_PX }}
        aria-hidden
      />

      {/* Handle icon — same center axis as needle */}
      <div
        className={`absolute left-0 z-10 flex w-5 -translate-x-1/2 items-start justify-center ${hitClass}`}
        style={{ top: HANDLE_TOP_PX, height: HANDLE_HEIGHT_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <PlayheadHandleIcon muted={muted} />
      </div>
    </div>
  );
}
