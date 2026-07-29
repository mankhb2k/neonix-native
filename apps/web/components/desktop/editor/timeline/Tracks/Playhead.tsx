"use client";

import {
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

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

/** Viewport X of playhead within the timeline board. */
export function timelineTimeToViewportLeft(
  time: number,
  labelWidth: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return labelWidth + time * Math.max(pixelsPerSecond, 1) - scrollLeft;
}

type Props = {
  /** Absolute left including label gutter (px) — used when not scrubbing. */
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
 * Scrub = imperative transform only; Zustand seek commits on pointerup
 * (avoids PreviewStage/TransportBar re-render jank mid-drag).
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
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);

  const labelWidthRef = useRef(labelWidth);
  const ppsRef = useRef(pixelsPerSecond);
  const maxTimeRef = useRef(maxTime);
  const onSeekRef = useRef(onSeek);
  labelWidthRef.current = labelWidth;
  ppsRef.current = pixelsPerSecond;
  maxTimeRef.current = maxTime;
  onSeekRef.current = onSeek;

  function applyVisualLeft(viewportLeft: number) {
    const el = rootRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${viewportLeft}px,0,0)`;
  }

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    applyVisualLeft(left);
  }, [left]);

  function scrubFromClientX(clientX: number): number | null {
    const root = scrollContainerRef.current;
    if (!root) return null;
    const time = clientXToTimelineTime(
      clientX,
      root,
      labelWidthRef.current,
      ppsRef.current,
      maxTimeRef.current,
    );
    applyVisualLeft(
      timelineTimeToViewportLeft(
        time,
        labelWidthRef.current,
        ppsRef.current,
        root.scrollLeft,
      ),
    );
    pendingTimeRef.current = time;
    return time;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const time = pendingTimeRef.current;
    pendingTimeRef.current = null;
    if (time != null) onSeekRef.current(time);
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
    // Visual only on down/move — store seek waits for pointerup.
    scrubFromClientX(event.clientX);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    scrubFromClientX(event.clientX);
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-0 top-0 z-50 will-change-transform"
      style={{ left: 0 }}
      aria-hidden={!enabled}
    >
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

      <div
        className="pointer-events-none absolute bottom-0 w-px -translate-x-1/2 bg-[var(--timeline-playhead)]"
        style={{ left: 0, top: 12 }}
      />

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
