"use client";

import { memo, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

export type TimelineClipItemVariant = "overlay" | "main" | "audio";

export type TimelineClipItemProps = {
  id: string;
  laneId: string | null | undefined;
  startTime: number;
  duration: number;
  name: string;
  selected: boolean;
  pixelsPerSecond: number;
  variant: TimelineClipItemVariant;
  /** Main-lane only: 1-based index label. */
  indexLabel?: number;
  onPointerDown: (event: ReactPointerEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

function clipClassName(
  variant: TimelineClipItemVariant,
  selected: boolean,
): string {
  const selectedCls = selected
    ? variant === "main"
      ? "z-10 border-2 border-white text-white shadow-md"
      : "z-10 border-2 border-white"
    : "";
  if (variant === "main") {
    return `absolute top-0 bottom-0 my-auto h-[90%] overflow-hidden rounded px-2 text-left text-[11px] flex flex-col justify-center bg-[var(--timeline-clip-frame)] text-white/90 ${selectedCls}`;
  }
  if (variant === "audio") {
    return `absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[var(--timeline-clip-audio)] px-2 text-[10px] font-medium text-white shadow-sm overflow-hidden ${selectedCls}`;
  }
  return `absolute top-0 bottom-0 my-auto flex h-[90%] items-center rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm overflow-hidden ${selectedCls}`;
}

function TimelineClipItemInner({
  id,
  laneId,
  startTime,
  duration,
  name,
  selected,
  pixelsPerSecond,
  variant,
  indexLabel,
  onPointerDown,
  onKeyDown,
}: TimelineClipItemProps) {
  const minWidth = variant === "main" ? 8 : 24;
  return (
    <div
      data-clip-id={id}
      data-lane-id={laneId ?? undefined}
      data-start-time={String(startTime)}
      role="button"
      tabIndex={0}
      className={clipClassName(variant, selected)}
      style={{
        left: startTime * pixelsPerSecond,
        width: Math.max(duration * pixelsPerSecond, minWidth),
      }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {variant === "main" ? (
        <>
          <span className="block truncate font-semibold text-white pointer-events-none">
            {indexLabel}. {name}
          </span>
          <span className="block truncate text-white/80 pointer-events-none">
            {duration}s
          </span>
        </>
      ) : variant === "overlay" ? (
        <span className="truncate pointer-events-none">
          {name} ({duration}s)
        </span>
      ) : (
        <span className="truncate pointer-events-none">{name}</span>
      )}
    </div>
  );
}

export const TimelineClipItem = memo(TimelineClipItemInner);
