"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { usePlaybackClock } from "@/lib/playback/playback-clock-store";

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
  labelWidth: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** False while sidebar/clip drag is active. */
  enabled?: boolean;
};

const HIT_STRIP_WIDTH_PX = 14;

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
 * CapCut-style playhead driven by the canonical playback clock.
 * Scrub coalesces pointermoves into one `seek()` per animation frame;
 * position always applies via `translate3d` (no React layout for the hot path).
 */
export function Playhead({
  labelWidth,
  pixelsPerSecond,
  scrollLeft,
  scrollContainerRef,
  enabled = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const labelWidthRef = useRef(labelWidth);
  const ppsRef = useRef(pixelsPerSecond);
  const scrollLeftRef = useRef(scrollLeft);
  labelWidthRef.current = labelWidth;
  ppsRef.current = pixelsPerSecond;
  scrollLeftRef.current = scrollLeft;

  const duration = usePlaybackClock((s) => s.duration);

  function applyVisualLeft(viewportLeft: number) {
    const el = rootRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${viewportLeft}px,0,0)`;
  }

  function syncFromClock(time: number) {
    applyVisualLeft(
      timelineTimeToViewportLeft(
        time,
        labelWidthRef.current,
        ppsRef.current,
        scrollLeftRef.current,
      ),
    );
  }

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    syncFromClock(usePlaybackClock.getState().currentTime);
  }, [labelWidth, pixelsPerSecond, scrollLeft]);

  useEffect(() => {
    syncFromClock(usePlaybackClock.getState().currentTime);
    return usePlaybackClock.subscribe((state, prev) => {
      if (state.currentTime === prev.currentTime) return;
      if (draggingRef.current) return;
      syncFromClock(state.currentTime);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function flushSeek() {
    rafRef.current = null;
    const time = pendingTimeRef.current;
    if (time == null) return;
    usePlaybackClock.getState().seek(time);
    syncFromClock(time);
  }

  function scheduleSeek(time: number) {
    pendingTimeRef.current = time;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushSeek);
  }

  function scrubFromClientX(clientX: number) {
    const root = scrollContainerRef.current;
    if (!root) return;
    const clock = usePlaybackClock.getState();
    const time = clientXToTimelineTime(
      clientX,
      root,
      labelWidthRef.current,
      ppsRef.current,
      clock.duration,
    );
    syncFromClock(time);
    scheduleSeek(time);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const time = pendingTimeRef.current;
    pendingTimeRef.current = null;
    if (time != null) usePlaybackClock.getState().seek(time);
    usePlaybackClock.getState().endScrub();
    syncFromClock(usePlaybackClock.getState().currentTime);
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
    usePlaybackClock.getState().beginScrub();
    event.currentTarget.setPointerCapture(event.pointerId);
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
        aria-valuemax={duration}
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
