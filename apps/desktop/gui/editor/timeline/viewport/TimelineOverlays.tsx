/**
 * Timeline drag overlays — library drop, clip-move chrome, snap guide, marquee.
 */

import type { ClipMovePreview } from "../clips/ClipStrip";
import type { LibraryDropPreview } from "../drop/library-drop";
import type { MarqueeRect } from "../selection/marquee-geometry";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";

type Props = {
  dropGhost: LibraryDropPreview | null;
  clipMovePreview: ClipMovePreview | null;
  marquee: MarqueeRect | null;
  pixelsPerSecond: number;
  canvasWidth: number;
  trackViewWidth: number;
  contentHeight: number;
  timelineEmpty: boolean;
};

export function TimelineOverlays({
  dropGhost,
  clipMovePreview,
  marquee,
  pixelsPerSecond,
  canvasWidth,
  trackViewWidth,
  contentHeight,
  timelineEmpty,
}: Props) {
  if (timelineEmpty) return null;

  const extentWidth = Math.max(canvasWidth, trackViewWidth);

  return (
    <>
      {dropGhost?.valid ? (
        dropGhost.isInsert ? (
          <>
            <div
              className="pointer-events-none absolute z-[30] h-8 -translate-y-1/2 overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md will-change-[left]"
              aria-hidden
              style={{
                top: dropGhost.contentTop,
                left:
                  TIMELINE_PLAYHEAD_GUTTER_PX +
                  dropGhost.startTime * pixelsPerSecond,
                width: dropGhost.ghostWidthPx,
              }}
            />
            <div
              data-testid="timeline-insert-indicator"
              data-drop-family={
                dropGhost.track === "audio" ? "audio" : "visual"
              }
              className="pointer-events-none absolute z-[40] h-px bg-[#14B8A6]"
              aria-hidden
              style={{
                top: dropGhost.contentTop,
                left: 0,
                width: extentWidth,
              }}
            />
          </>
        ) : (
          <div
            className="pointer-events-none absolute z-[30] -translate-y-1/2 overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md will-change-[left]"
            aria-hidden
            style={{
              top: dropGhost.contentTop,
              left:
                TIMELINE_PLAYHEAD_GUTTER_PX +
                dropGhost.startTime * pixelsPerSecond,
              width: dropGhost.ghostWidthPx,
              height: dropGhost.ghostHeightPx,
            }}
          />
        )
      ) : dropGhost && !dropGhost.valid ? (
        <div
          className="pointer-events-none absolute z-[5] w-2 -translate-y-1/2"
          aria-hidden
          style={{
            top: dropGhost.contentTop,
            left:
              TIMELINE_PLAYHEAD_GUTTER_PX +
              dropGhost.startTime * pixelsPerSecond,
            height: dropGhost.ghostHeightPx,
          }}
        >
          <div className="-ml-px h-full w-0.5 bg-[var(--danger)] opacity-70" />
        </div>
      ) : null}
      {clipMovePreview?.isInsert &&
      clipMovePreview.valid &&
      clipMovePreview.contentTop != null ? (
        <>
          <div
            className="pointer-events-none absolute z-[30] h-8 -translate-y-1/2 overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md"
            aria-hidden
            style={{
              top: clipMovePreview.contentTop,
              left:
                TIMELINE_PLAYHEAD_GUTTER_PX +
                clipMovePreview.startTime * pixelsPerSecond,
              width: Math.max(
                24,
                clipMovePreview.duration * pixelsPerSecond,
              ),
            }}
          />
          <div
            data-testid="timeline-clip-insert-indicator"
            className="pointer-events-none absolute z-[40] h-px bg-[#14B8A6]"
            aria-hidden
            style={{
              top: clipMovePreview.contentTop,
              left: 0,
              width: extentWidth,
            }}
          />
        </>
      ) : null}
      {(clipMovePreview?.snapGuideTime ?? dropGhost?.snapGuideTime) != null ? (
        <div
          data-testid="timeline-clip-snap-guide"
          className="pointer-events-none absolute top-0 z-[42] w-px bg-[#14B8A6]"
          aria-hidden
          style={{
            left:
              TIMELINE_PLAYHEAD_GUTTER_PX +
              (clipMovePreview?.snapGuideTime ?? dropGhost!.snapGuideTime!) *
                pixelsPerSecond,
            height: contentHeight,
          }}
        />
      ) : null}
      {clipMovePreview &&
      clipMovePreview.clientX != null &&
      clipMovePreview.clientY != null ? (
        <div
          className="pointer-events-none fixed z-[35] flex h-8 items-center overflow-hidden rounded border border-[#14B8A6]/40 bg-[#0D7476] px-2.5 text-[11px] font-semibold text-white opacity-95 shadow-2xl"
          aria-hidden
          data-testid="timeline-clip-move-cyan"
          style={{
            left: clipMovePreview.clientX,
            top: clipMovePreview.clientY - 16,
            width: Math.max(24, clipMovePreview.duration * pixelsPerSecond),
          }}
        >
          <span className="truncate">
            {clipMovePreview.label || clipMovePreview.clipId}
          </span>
        </div>
      ) : null}
      {marquee ? (
        <div
          className="pointer-events-none absolute z-[6] border border-[var(--timeline-playhead)] bg-white/10"
          aria-hidden
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.right - marquee.left,
            height: marquee.bottom - marquee.top,
          }}
        />
      ) : null}
    </>
  );
}
