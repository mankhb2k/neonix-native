"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";

/** Convert pointer X → timeline seconds (accounts for label gutter + horizontal scroll). */
export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  labelWidth: number,
  pixelsPerSecond: number,
  maxTime: number,
): number {
  void labelWidth;
  const rect = scrollContainer.getBoundingClientRect();
  const x = clientX - rect.left + scrollContainer.scrollLeft;
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

function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = playbackFrameIndex(seconds, fps);
  const safeFps = Math.max(1, Math.round(fps));
  const ff = totalFrames % safeFps;
  const totalSeconds = Math.floor(totalFrames / safeFps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
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
 * Hot path: transform + aria attributes via DOM — no React setState per tick.
 */
export function Playhead({
  labelWidth,
  pixelsPerSecond,
  scrollLeft,
  scrollContainerRef,
  enabled = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const labelWidthRef = useRef(labelWidth);
  const ppsRef = useRef(pixelsPerSecond);
  const scrollLeftRef = useRef(scrollLeft);
  const fpsRef = useRef(30);
  labelWidthRef.current = labelWidth;
  ppsRef.current = pixelsPerSecond;
  scrollLeftRef.current = scrollLeft;

  const duration = usePlaybackClock((s) => s.duration);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  fpsRef.current = fps;

  const applyVisualLeft = useCallback((viewportLeft: number) => {
    const el = rootRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${viewportLeft}px,0,0)`;
  }, []);

  const syncFromClock = useCallback(
    (time: number) => {
      applyVisualLeft(
        timelineTimeToViewportLeft(
          time,
          labelWidthRef.current,
          ppsRef.current,
          scrollLeftRef.current,
        ),
      );
      const slider = sliderRef.current;
      if (slider) {
        slider.setAttribute("aria-valuenow", String(time));
        slider.setAttribute(
          "aria-valuetext",
          formatTimecode(time, fpsRef.current),
        );
      }
    },
    [applyVisualLeft],
  );

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    syncFromClock(usePlaybackClock.getState().currentTime);
  }, [labelWidth, pixelsPerSecond, scrollLeft, syncFromClock]);

  useEffect(() => {
    syncFromClock(usePlaybackClock.getState().currentTime);
    return usePlaybackClock.subscribe((state, prev) => {
      if (state.currentTime === prev.currentTime) return;
      if (draggingRef.current) return;
      syncFromClock(state.currentTime);
    });
  }, [syncFromClock]);

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

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!enabled) return;
    const clock = usePlaybackClock.getState();
    const frameSec = 1 / Math.max(1, fps);
    const step = event.shiftKey ? frameSec * 10 : frameSec;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      clock.seek(clock.currentTime - step);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      clock.seek(clock.currentTime + step);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      clock.seek(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      clock.seek(clock.duration);
    }
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-0 top-0 z-50 will-change-transform"
      style={{ left: 0 }}
      aria-hidden={!enabled}
    >
      <div
        ref={sliderRef}
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={duration}
        // Initial/re-render value from store; ticks update the attribute imperatively.
        aria-valuenow={usePlaybackClock.getState().currentTime}
        tabIndex={enabled ? 0 : -1}
        className={`absolute top-0 bottom-0 -translate-x-1/2 touch-none cursor-ew-resize ${
          enabled ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ left: 0, width: HIT_STRIP_WIDTH_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
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
