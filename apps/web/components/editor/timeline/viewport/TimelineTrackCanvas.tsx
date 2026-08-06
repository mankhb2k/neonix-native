"use client";

import { ClipStrip } from "../clips/ClipStrip";
import type { DesignClip } from "../fixtures/design-board";
import type { DesignLaneRow } from "../lanes/timeline-lane-rows";
import { LANE_GAP_PX } from "../timeline-scale";

type Props = {
  rows: DesignLaneRow[];
  clips: DesignClip[];
  pixelsPerSecond: number;
  contentWidth: number;
  muteWindow?: { start: number; end: number } | null;
  duration: number;
};

export function TimelineTrackCanvas({
  rows,
  clips,
  pixelsPerSecond,
  contentWidth,
  muteWindow,
  duration,
}: Props) {
  return (
    <div
      className="relative min-h-0 flex-1"
      style={{ width: contentWidth }}
      data-testid="timeline-track-canvas"
    >
      {muteWindow ? (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[1] bg-[var(--fg-primary)]/6"
            style={{
              left: 0,
              width: Math.max(0, muteWindow.start) * pixelsPerSecond,
            }}
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[1] bg-[var(--fg-primary)]/6"
            style={{
              left: muteWindow.end * pixelsPerSecond,
              width: Math.max(0, duration - muteWindow.end) * pixelsPerSecond,
            }}
          />
        </>
      ) : null}

      {rows.map((row) => {
        const laneClips = clips.filter((c) => c.laneId === row.id);
        return (
          <div
            key={row.id}
            className="relative border-b border-[var(--border-subtle)] bg-[var(--timeline-track-lane)]"
            style={{ height: row.height, marginBottom: LANE_GAP_PX }}
            data-lane-id={row.id}
          >
            {laneClips.map((clip) => (
              <ClipStrip
                key={clip.id}
                clip={clip}
                pixelsPerSecond={pixelsPerSecond}
                showTrimHandles
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
