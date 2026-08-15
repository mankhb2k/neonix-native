"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  scrollLeft: number;
  contentWidth: number;
  viewportWidth: number;
  onScrollLeft: (left: number) => void;
};

const MIN_THUMB_PX = 28;
const TRACK_HEIGHT_PX = 10;
/** CapCut: tiny dead zone so the thumb never flush-closes — bar always visible. */
const END_INSET_PX = 4;

/**
 * CapCut-style detached H-scrollbar — always painted (END_INSET gap).
 */
export function TimelineHScrollBar({
  scrollLeft,
  contentWidth,
  viewportWidth,
  onScrollLeft,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => {
      const next = el.clientWidth;
      setTrackWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxScroll = Math.max(0, contentWidth - viewportWidth);
  const usableWidth = Math.max(0, trackWidth - END_INSET_PX);

  const thumbWidth =
    usableWidth <= 0
      ? 0
      : maxScroll <= 0 || contentWidth <= 0
        ? usableWidth
        : Math.min(
            usableWidth,
            Math.max(MIN_THUMB_PX, (viewportWidth / contentWidth) * usableWidth),
          );
  const travel = Math.max(0, usableWidth - thumbWidth);
  const thumbLeft =
    maxScroll <= 0 || travel <= 0 ? 0 : (scrollLeft / maxScroll) * travel;

  const canScroll = maxScroll > 0 && travel > 0;

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canScroll) return;
    const target = event.target as HTMLElement;
    if (target.dataset.timelineHThumb === "true") return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = event.clientX - rect.left - thumbWidth / 2;
    const ratio = Math.min(1, Math.max(0, x / Math.max(1, travel)));
    onScrollLeft(ratio * maxScroll);
  };

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canScroll) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: scrollLeft,
    };
  };

  const onThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canScroll) return;
    const dx = event.clientX - drag.startX;
    const next = drag.startScroll + (dx / Math.max(1, travel)) * maxScroll;
    onScrollLeft(Math.min(maxScroll, Math.max(0, next)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div
      ref={trackRef}
      className="relative w-full min-w-0 shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-editor)]"
      style={{ height: TRACK_HEIGHT_PX }}
      data-testid="timeline-hscroll"
      aria-label="Timeline horizontal scroll"
      role="scrollbar"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={maxScroll}
      aria-valuenow={scrollLeft}
      onPointerDown={onTrackPointerDown}
    >
      {trackWidth > 0 && thumbWidth > 0 ? (
        <div
          data-timeline-h-thumb="true"
          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--fg-muted)]/45 ${
            canScroll
              ? "cursor-pointer hover:bg-[var(--fg-muted)]/70 active:bg-[var(--fg-secondary)]"
              : "pointer-events-none"
          }`}
          style={{ width: thumbWidth, left: thumbLeft }}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      ) : null}
    </div>
  );
}
