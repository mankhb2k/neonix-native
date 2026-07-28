"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Convert pointer X → timeline seconds (accounts for label gutter + horizontal scroll). */
export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  labelWidth: number,
  pixelsPerSecond: number,
  maxTime: number,
): number {
  const rect = scrollContainer.getBoundingClientRect();
  const x = clientX - rect.left + scrollContainer.scrollLeft - labelWidth;
  const time = x / Math.max(pixelsPerSecond, 1);
  return Math.min(Math.max(0, time), Math.max(0, maxTime));
}

type Props = {
  /** Absolute left including label gutter (px). */
  left: number;
  labelWidth: number;
  pixelsPerSecond: number;
  maxTime: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** False while sidebar/clip drag is active. */
  enabled?: boolean;
  onSeek: (time: number) => void;
};

const HIT_STRIP_WIDTH_PX = 14;

/** CapCut inverted-house — solid fill, flat top flush to ruler edge. */
function PlayheadHandleIcon() {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      aria-hidden
      className="text-[var(--timeline-playhead)]"
    >
      <path
        d="M0 0h11v7.5L5.5 13 0 7.5V0z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * CapCut-style playhead: white line + solid shield handle flush to ruler top.
 */
export function Playhead({
  left,
  labelWidth,
  pixelsPerSecond,
  maxTime,
  scrollContainerRef,
  enabled = true,
  onSeek,
}: Props) {
  const draggingRef = useRef(false);

  function seekFromClientX(clientX: number) {
    const root = scrollContainerRef.current;
    if (!root) return;
    onSeek(
      clientXToTimelineTime(
        clientX,
        root,
        labelWidth,
        pixelsPerSecond,
        maxTime,
      ),
    );
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    seekFromClientX(event.clientX);
  }

  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-50"
      style={{ left }}
      aria-hidden={!enabled}
    >
      {/* Invisible hit strip — full height scrub */}
      <div
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={maxTime}
        tabIndex={enabled ? 0 : -1}
        className={`absolute top-0 bottom-0 -translate-x-1/2 touch-none cursor-ew-resize ${
          enabled ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ left: 0, width: HIT_STRIP_WIDTH_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />

      {/* Visible 1px line — starts under tip of handle */}
      <div
        className="pointer-events-none absolute bottom-0 w-px -translate-x-1/2 bg-[var(--timeline-playhead)]"
        style={{ left: 0, top: 12 }}
      />

      {/* Solid handle flush to top edge of TimeRuler — above sticky ruler bg */}
      <div
        className={`absolute top-0 left-0 z-10 flex w-5 -translate-x-1/2 items-start justify-center touch-none cursor-ew-resize ${
          enabled ? "pointer-events-auto" : "pointer-events-none opacity-60"
        }`}
        style={{ height: 13 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <PlayheadHandleIcon />
      </div>
    </div>
  );
}
