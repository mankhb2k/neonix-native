"use client";

type Props = {
  scrollLeft: number;
  contentWidth: number;
  viewportWidth: number;
  onScrollLeft: (left: number) => void;
};

/** Presentational H-scroll chrome. */
export function TimelineHScrollBar({
  scrollLeft,
  contentWidth,
  viewportWidth,
  onScrollLeft,
}: Props) {
  const maxScroll = Math.max(0, contentWidth - viewportWidth);
  const thumbRatio =
    contentWidth <= 0 ? 1 : Math.min(1, viewportWidth / contentWidth);
  const thumbWidth = Math.max(32, thumbRatio * Math.max(viewportWidth, 1));
  const thumbLeft =
    maxScroll <= 0 ? 0 : (scrollLeft / maxScroll) * (viewportWidth - thumbWidth);

  return (
    <div
      className="relative h-3 shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      data-testid="timeline-hscroll"
      onPointerDown={(e) => {
        if (maxScroll <= 0 || e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const next = ((x - thumbWidth / 2) / Math.max(1, rect.width - thumbWidth)) * maxScroll;
        onScrollLeft(Math.min(maxScroll, Math.max(0, next)));
      }}
    >
      <div
        className="absolute top-0.5 h-2 rounded-full bg-[var(--border-strong)]"
        style={{ width: thumbWidth, left: thumbLeft }}
      />
    </div>
  );
}
