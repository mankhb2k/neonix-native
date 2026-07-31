/**
 * CapCut-style playhead for Vite timeline (Wave D).
 * Hot path: transform via DOM — no React setState per playback tick.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  usePlaybackClockApi,
  usePlaybackClock,
} from "../playback/playback-clock-store";
import {
  clientXToTimelineTime,
  timelineTimeToViewportLeft,
} from "./timeline-seek";

type Props = {
  tracksOriginX: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
  maxTime: number;
  enabled?: boolean;
};

export function Playhead({
  tracksOriginX,
  pixelsPerSecond,
  scrollLeft,
  scrollContainerRef,
  maxTime,
  enabled = true,
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
  const currentTime = usePlaybackClock((s) => s.currentTime);
  const seekRevision = usePlaybackClock((s) => s.seekRevision);

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
    syncFromClock(currentTime);
  }, [currentTime, seekRevision, scrollLeft, pixelsPerSecond, tracksOriginX, syncFromClock]);

  useEffect(() => {
    return clock.subscribe((state) => {
      if (draggingRef.current) return;
      if (state.mode !== "playing") return;
      syncFromClock(state.currentTime);
    });
  }, [clock, syncFromClock]);

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
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={rootRef}
      className="timeline-playhead"
      data-testid="timeline-playhead"
      style={{ pointerEvents: enabled ? "auto" : "none" }}
      onPointerDown={onPointerDown}
    >
      <div className="timeline-playhead__head" aria-hidden />
      <div className="timeline-playhead__line" aria-hidden />
    </div>
  );
}
