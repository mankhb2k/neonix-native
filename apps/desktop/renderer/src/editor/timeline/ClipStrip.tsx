/**
 * Display-only clip strip (Phase 10) — no pointer interaction.
 */

import type { TimelineClip } from "@motionvideo/editor-core";

type Props = {
  clips: TimelineClip[];
  pixelsPerSecond: number;
  laneHeight: number;
};

export function ClipStrip({ clips, pixelsPerSecond, laneHeight }: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const padY = 4;
  const height = Math.max(8, laneHeight - padY * 2);

  return (
    <div className="timeline-clip-strip" aria-hidden>
      {clips.map((clip) => {
        const left = clip.startTime * pps;
        const width = Math.max(2, clip.duration * pps);
        return (
          <div
            key={clip.id}
            className="timeline-clip-strip__clip"
            data-testid="timeline-clip-strip"
            data-clip-id={clip.id}
            style={{
              left,
              width,
              top: padY,
              height,
            }}
            title={clip.name || clip.id}
          />
        );
      })}
    </div>
  );
}
