"use client";

type Props = {
  leftPx: number;
  muted?: boolean;
};

/** Presentational CapCut-style playhead (no scrub wiring in design phase). */
export function Playhead({ leftPx, muted }: Props) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20"
      style={{ left: leftPx, transform: "translateX(-50%)" }}
      data-testid="timeline-playhead"
    >
      <svg
        width="11"
        height="13"
        viewBox="0 0 11 13"
        fill="none"
        aria-hidden
        className={
          muted
            ? "relative z-10 text-[var(--fg-disabled)]"
            : "relative z-10 text-[var(--timeline-playhead)]"
        }
        style={{ marginLeft: -5.5 }}
      >
        <path d="M0 0h11v7.5L5.5 13 0 7.5V0z" fill="currentColor" />
      </svg>
      <div
        className={
          muted
            ? "absolute top-[11px] bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--fg-disabled)]"
            : "absolute top-[11px] bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--timeline-playhead)]"
        }
      />
    </div>
  );
}
