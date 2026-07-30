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

/** Convert pointer X → timeline seconds (scroll container is the tracks canvas). */
export function clientXToTimelineTime(
  clientX: number,
  scrollContainer: HTMLElement,
  _tracksOriginX: number,
  pixelsPerSecond: number,
  maxTime: number,
): number {
  void _tracksOriginX;
  const rect = scrollContainer.getBoundingClientRect();
  const x = clientX - rect.left + scrollContainer.scrollLeft;
  const time = x / Math.max(pixelsPerSecond, 1);
  return Math.min(Math.max(0, time), Math.max(0, maxTime));
}

/** Viewport X of playhead within the timeline board (labels + gutter + time). */
export function timelineTimeToViewportLeft(
  time: number,
  tracksOriginX: number,
  pixelsPerSecond: number,
  scrollLeft: number,
): number {
  return tracksOriginX + time * Math.max(pixelsPerSecond, 1) - scrollLeft;
}

type Props = {
  /** Board X where t=0 sits (label column + playhead gutter). */
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** False while sidebar/clip drag is active. */
  enabled?: boolean;
};

const HIT_STRIP_WIDTH_PX = 14;

function PlayheadHandleIcon({ isMuted = false }: { isMuted?: boolean }) {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      aria-hidden
      className={isMuted ? "text-white/35" : "text-[var(--timeline-playhead)]"}
    >
      <path d="M0 0h11v7.5L5.5 13 0 7.5V0z" fill="currentColor" />
    </svg>
  );
}

/**
 * CapCut-style playhead driven by the canonical playback clock.
 * Hot path: transform + aria attributes via DOM — no React setState per tick.
 */
export function Playhead({
  tracksOriginX,
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

  const tracksOriginXRef = useRef(tracksOriginX);
  const ppsRef = useRef(pixelsPerSecond);
  const scrollLeftRef = useRef(scrollLeft);
  const fpsRef = useRef(30);
  tracksOriginXRef.current = tracksOriginX;
  ppsRef.current = pixelsPerSecond;
  scrollLeftRef.current = scrollLeft;

  const duration = usePlaybackClock((s) => s.duration);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const isTimelineEmpty = useEditorStore((s) => s.timelineClips.length === 0);
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
          tracksOriginXRef.current,
          ppsRef.current,
          scrollLeftRef.current,
        ),
      );
      const slider = sliderRef.current;
      if (slider) {
        slider.setAttribute("aria-valuenow", String(time));
      }
    },
    [applyVisualLeft],
  );

  useEffect(() => {
    return usePlaybackClock.subscribe((state, prev) => {
      if (state.currentTime !== prev.currentTime) {
        syncFromClock(state.currentTime);
      }
    });
  }, [syncFromClock]);

  useLayoutEffect(() => {
    syncFromClock(usePlaybackClock.getState().currentTime);
  }, [scrollLeft, pixelsPerSecond, tracksOriginX, syncFromClock]);

  const scheduleSeek = (time: number) => {
    pendingTimeRef.current = time;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const t = pendingTimeRef.current;
      if (t != null) {
        usePlaybackClock.getState().seek(t);
      }
    });
  };

  const scrubFromClientX = (clientX: number) => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const time = clientXToTimelineTime(
      clientX,
      root,
      tracksOriginXRef.current,
      ppsRef.current,
      Math.max(0, usePlaybackClock.getState().duration),
    );
    syncFromClock(time);
    scheduleSeek(time);
  };

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
      className="pointer-events-none absolute bottom-0 top-0 z-40 will-change-transform"
      style={{ left: 0 }}
      aria-hidden={!enabled}
    >
      <div
        ref={sliderRef}
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={duration}
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
        className={`pointer-events-none absolute bottom-0 w-px -translate-x-1/2 transition-colors duration-200 ${
          isTimelineEmpty ? "bg-white/30" : "bg-[var(--timeline-playhead)]"
        }`}
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
        <PlayheadHandleIcon isMuted={isTimelineEmpty} />
      </div>
    </div>
  );
}
