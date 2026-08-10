"use client";

import { formatTimecode } from "../timeline-scale";

type Props = {
  currentTime: number;
  fps: number;
};

/** Always HH:MM:SS:FF — Roboto Mono keeps digit width fixed. */
export function CurrentTimeDisplay({ currentTime, fps }: Props) {
  return (
    <span
      className="block w-[11ch] shrink-0 text-right font-mono text-[12px] leading-none tabular-nums tracking-tight text-[var(--fg-secondary)]"
      style={{ fontFamily: "var(--font-mono)" }}
      data-testid="timeline-current-time"
    >
      {formatTimecode(currentTime, fps)}
    </span>
  );
}
