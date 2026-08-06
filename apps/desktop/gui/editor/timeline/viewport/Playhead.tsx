/**
 * CapCut-style playhead — DOM transform hot path (no React tick subscription).
 * Scrub: visual first, RAF-batched clock seek (web parity).
 * Near-edge horizontal auto-scroll while dragging so scrub can reach contentEnd.
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
  ensurePlayheadScrubScroll,
  resolvePlayheadScrubMax,
  timelineTimeToViewportLeft,
} from "@motionvideo/editor-interactions";

type Props = {
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** Inclusive scrub floor (layer mode = container start). */
  minTime?: number;
  maxTime: number;
  enabled?: boolean;
  /** Empty timeline → muted playhead (web parity). */
  muted?: boolean;
};

const HIT_STRIP_WIDTH_PX = 14;
const HANDLE_HEIGHT_PX = 13;
/** CapCut: head sits on the TimeRuler (above ticks), tip points into tracks. */
const HANDLE_TOP_PX = 1;
/** Needle starts at the handle tip so the line continues through the ruler. */
const NEEDLE_TOP_PX = HANDLE_TOP_PX + HANDLE_HEIGHT_PX - 2;

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
  minTime = 0,
  maxTime,
  enabled = true,
  muted = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const edgeRafRef = useRef<number | null>(null);
  const lastClientXRef = useRef(0);
  const captureTargetRef = useRef<HTMLElement | null>(null);

  const tracksOriginXRef = useRef(tracksOriginX);
  const ppsRef = useRef(pixelsPerSecond);
  const scrollLeftRef = useRef(scrollLeft);
  const minTimeRef = useRef(minTime);
  const maxTimeRef = useRef(maxTime);
  tracksOriginXRef.current = tracksOriginX;
  ppsRef.current = pixelsPerSecond;
  scrollLeftRef.current = scrollLeft;
  minTimeRef.current = minTime;
  maxTimeRef.current = maxTime;

  const clock = usePlaybackClockApi();
  const interactive = enabled && !muted;

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

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    syncFromClock(muted ? 0 : clock.getState().currentTime);
  }, [scrollLeft, pixelsPerSecond, tracksOriginX, clock, syncFromClock, muted]);

  useEffect(() => {
    return clock.subscribe((state, prev) => {
      if (draggingRef.current) return;
      if (state.currentTime === prev.currentTime) return;
      syncFromClock(state.currentTime);
    });
  }, [clock, syncFromClock]);

  const stopEdgeLoop = useCallback(() => {
    if (edgeRafRef.current != null) {
      cancelAnimationFrame(edgeRafRef.current);
      edgeRafRef.current = null;
    }
  }, []);

  const finishScrub = useCallback(
    (opts?: { releaseCapture?: boolean; pointerId?: number }) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      stopEdgeLoop();

      // Flush pending seek only if RAF has not consumed it yet.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        const time = pendingTimeRef.current;
        pendingTimeRef.current = null;
        if (time != null) clock.getState().seek(time);
      } else {
        pendingTimeRef.current = null;
      }

      clock.getState().endScrub();
      syncFromClock(clock.getState().currentTime);

      if (opts?.releaseCapture !== false) {
        const target = captureTargetRef.current;
        const pointerId = opts?.pointerId;
        if (
          target != null &&
          pointerId != null &&
          target.hasPointerCapture?.(pointerId)
        ) {
          try {
            target.releasePointerCapture(pointerId);
          } catch {
            /* already released */
          }
        }
      }
      captureTargetRef.current = null;
    },
    [clock, stopEdgeLoop, syncFromClock],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      stopEdgeLoop();
      if (draggingRef.current) {
        draggingRef.current = false;
        pendingTimeRef.current = null;
        clock.getState().endScrub();
      }
    };
  }, [clock, stopEdgeLoop]);

  const scheduleSeek = (time: number) => {
    pendingTimeRef.current = time;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const t = pendingTimeRef.current;
      pendingTimeRef.current = null;
      if (t != null) {
        clock.getState().seek(t);
      }
    });
  };

  const scrubFromClientX = (clientX: number) => {
    const scroll = scrollContainerRef.current;
    if (!scroll) return;
    lastClientXRef.current = clientX;
    const clockDuration = clock.getState().duration;
    // Surface max wins over clock (layer = container end); clock still caps
    // track scrub inside padded extent when content is shorter.
    const scrubMax = resolvePlayheadScrubMax(
      maxTimeRef.current,
      clockDuration,
    );
    const { time, scrolledBy } = ensurePlayheadScrubScroll(
      scroll,
      clientX,
      ppsRef.current,
      scrubMax,
      40,
      14,
      minTimeRef.current,
    );
    if (scrolledBy !== 0) {
      scrollLeftRef.current = scroll.scrollLeft;
    }
    // Visual first — never wait on store subscribers for the needle.
    syncFromClock(time);
    scheduleSeek(time);
  };

  const ensureEdgeLoop = () => {
    if (edgeRafRef.current != null) return;
    const tick = () => {
      edgeRafRef.current = null;
      if (!draggingRef.current) return;
      const scroll = scrollContainerRef.current;
      if (!scroll) return;
      const clientX = lastClientXRef.current;
      const rect = scroll.getBoundingClientRect();
      const nearRight = clientX > rect.right - 40;
      const nearLeft = clientX < rect.left + 40;
      if (!nearRight && !nearLeft) return;
      const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      const canRight = nearRight && scroll.scrollLeft < maxScroll;
      const canLeft = nearLeft && scroll.scrollLeft > 0;
      if (!canRight && !canLeft) return;
      scrubFromClientX(clientX);
      edgeRafRef.current = requestAnimationFrame(tick);
    };
    edgeRafRef.current = requestAnimationFrame(tick);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishScrub({ pointerId: event.pointerId });
  };

  const onLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishScrub({
      pointerId: event.pointerId,
      releaseCapture: false,
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    captureTargetRef.current = event.currentTarget;
    clock.getState().beginScrub();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubFromClientX(event.clientX);
    ensureEdgeLoop();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    scrubFromClientX(event.clientX);
    ensureEdgeLoop();
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-y-0 z-[45] will-change-transform"
      data-testid="timeline-playhead"
      data-muted={muted ? "true" : undefined}
      style={{ left: 0 }}
      aria-hidden={!interactive}
    >
      <div
        ref={sliderRef}
        role="slider"
        aria-label="Playhead"
        aria-disabled={muted || !enabled}
        tabIndex={interactive ? 0 : -1}
        className={`absolute bottom-0 -translate-x-1/2 touch-none ${
          interactive
            ? "pointer-events-auto cursor-ew-resize"
            : "pointer-events-none"
        }`}
        style={{ left: 0, top: NEEDLE_TOP_PX, width: HIT_STRIP_WIDTH_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={onLostPointerCapture}
      />

      <div
        className={`pointer-events-none absolute bottom-0 w-px -translate-x-1/2 ${
          muted ? "bg-white/30" : "bg-[var(--timeline-playhead)]"
        }`}
        style={{ left: 0, top: NEEDLE_TOP_PX }}
        aria-hidden
      />

      <div
        className={`absolute left-0 z-10 flex w-5 -translate-x-1/2 items-start justify-center touch-none ${
          interactive
            ? "pointer-events-auto cursor-ew-resize"
            : "pointer-events-none opacity-60"
        }`}
        style={{ top: HANDLE_TOP_PX, height: HANDLE_HEIGHT_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={onLostPointerCapture}
      >
        <PlayheadHandleIcon isMuted={muted} />
      </div>
    </div>
  );
}
