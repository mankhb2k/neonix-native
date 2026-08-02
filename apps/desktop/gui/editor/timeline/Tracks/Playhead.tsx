/**
 * CapCut-style playhead — DOM transform hot path (no React tick subscription).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { usePlaybackClockApi } from "../../playback/playback-clock-store";
import {
  clientXToTimelineTime,
  timelineTimeToViewportLeft,
} from "../timeline-seek";

type Props = {
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  maxTime: number;
  enabled?: boolean;
  /** Empty timeline → muted playhead (web parity). */
  muted?: boolean;
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
      className={
        isMuted ? "text-white/35" : "text-[var(--timeline-playhead)]"
      }
    >
      <path d="M0 0h11v7.5L5.5 13 0 7.5V0z" fill="currentColor" />
    </svg>
  );
}

export function Playhead({
  tracksOriginX,
  pixelsPerSecond,
  scrollLeft,
  scrollContainerRef,
  maxTime,
  enabled = true,
  muted = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const tracksOriginXRef = useRef(tracksOriginX);
  const ppsRef = useRef(pixelsPerSecond);
  const scrollLeftRef = useRef(scrollLeft);
  const maxTimeRef = useRef(maxTime);
  tracksOriginXRef.current = tracksOriginX;
  ppsRef.current = pixelsPerSecond;
  scrollLeftRef.current = scrollLeft;
  maxTimeRef.current = maxTime;

  const clock = usePlaybackClockApi();

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
    },
    [applyVisualLeft],
  );

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    syncFromClock(clock.getState().currentTime);
  }, [scrollLeft, pixelsPerSecond, tracksOriginX, clock, syncFromClock]);

  useEffect(() => {
    return clock.subscribe((state) => {
      if (draggingRef.current) return;
      syncFromClock(state.currentTime);
    });
  }, [clock, syncFromClock]);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, [clock]);

  const seekFromClientX = (clientX: number) => {
    const scroll = scrollContainerRef.current;
    if (!scroll) return;
    const time = clientXToTimelineTime(
      clientX,
      scroll,
      ppsRef.current,
      maxTimeRef.current,
    );
    clock.getState().seek(time);
    syncFromClock(time);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragCleanupRef.current?.();
    draggingRef.current = true;
    clock.getState().beginScrub();
    seekFromClientX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (ev: PointerEvent) => seekFromClientX(ev.clientX);
    const onUp = () => {
      draggingRef.current = false;
      clock.getState().endScrub();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = onUp;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-0 top-0 z-40 will-change-transform"
      data-testid="timeline-playhead"
      style={{ left: 0 }}
      aria-hidden={!enabled}
    >
      <div
        role="slider"
        aria-label="Playhead"
        tabIndex={enabled ? 0 : -1}
        className={`absolute top-0 bottom-0 -translate-x-1/2 touch-none cursor-ew-resize ${
          enabled ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ left: 0, width: HIT_STRIP_WIDTH_PX }}
        onPointerDown={onPointerDown}
      />

      <div
        className={`pointer-events-none absolute bottom-0 w-px -translate-x-1/2 ${
          muted ? "bg-white/30" : "bg-[var(--timeline-playhead)]"
        }`}
        style={{ left: 0, top: 12 }}
        aria-hidden
      />

      <div
        className={`absolute top-0 left-0 z-10 flex w-5 -translate-x-1/2 items-start justify-center touch-none cursor-ew-resize ${
          enabled ? "pointer-events-auto" : "pointer-events-none opacity-60"
        }`}
        style={{ height: 13 }}
        onPointerDown={onPointerDown}
      >
        <PlayheadHandleIcon isMuted={muted} />
      </div>
    </div>
  );
}
