/**
 * Timeline drag overlays — library drop, clip-move chrome, snap guide, marquee.
 * Preview payloads come from timeline-preview-session (not parent React state).
 */

import type { RefObject } from "react";
import { usePreviewSession } from "../interactions/timeline-preview-session";
import { TIMELINE_PLAYHEAD_GUTTER_PX } from "../timeline-scale";
import { cn } from "../../../ui";
import { clipVisualClassName } from "../clips/ClipStrip";

type Props = {
  pixelsPerSecond: number;
  canvasWidth: number;
  trackViewWidth: number;
  contentHeight: number;
  timelineEmpty: boolean;
  /** Scrollport — cyan bar left anchors to ghost startTime (viewport coords). */
  tracksScrollRef?: RefObject<HTMLDivElement | null>;
  /** Triggers cyan left recompute when the track canvas scrolls. */
  scrollLeft?: number;
};

export function TimelineOverlays({
  pixelsPerSecond,
  canvasWidth,
  trackViewWidth,
  contentHeight,
  timelineEmpty,
  tracksScrollRef,
  scrollLeft = 0,
}: Props) {
  const { dropGhost, clipMovePreview, marquee } = usePreviewSession();

  if (timelineEmpty) return null;

  const extentWidth = Math.max(canvasWidth, trackViewWidth);

  /** Cyan left = ghost startTime in viewport; top stays on pointer Y. */
  let clipMoveCyanLeft: number | null = null;
  if (clipMovePreview != null && clipMovePreview.clientY != null) {
    const scrollEl = tracksScrollRef?.current;
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      clipMoveCyanLeft =
        rect.left +
        TIMELINE_PLAYHEAD_GUTTER_PX +
        clipMovePreview.startTime * pixelsPerSecond -
        scrollLeft;
    } else if (clipMovePreview.clientX != null) {
      clipMoveCyanLeft = clipMovePreview.clientX;
    }
  }

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
              className="pointer-events-none absolute z-[30] h-px bg-[#14B8A6]"
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
            className="pointer-events-none absolute z-[30] h-px bg-[#14B8A6]"
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
          className="pointer-events-none absolute top-0 z-[32] w-px bg-[#14B8A6]"
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
      clipMoveCyanLeft != null &&
      clipMovePreview.clientY != null ? (() => {
        const primaryTop = clipMovePreview.clientY - (clipMovePreview.grabOffsetY ?? 16);
        const validCls = clipMovePreview.valid ? "" : "border-2 border-[var(--danger)] bg-[var(--danger)]/40";
        
        return (
          <>
            <div
              className={cn(
                "pointer-events-none fixed z-[35] flex items-center opacity-90 shadow-2xl will-change-[left]",
                clipVisualClassName(clipMovePreview.trackKind, true),
                validCls
              )}
              aria-hidden
              data-testid="timeline-clip-move-float"
              style={{
                left: clipMoveCyanLeft,
                top: primaryTop,
                width: Math.max(24, clipMovePreview.duration * pixelsPerSecond),
                height: clipMovePreview.trackKind === "main" ? 57.6 : 46.08,
              }}
            >
              <span className="min-w-0 truncate font-semibold leading-tight pointer-events-none">
                {clipMovePreview.label || clipMovePreview.clipId}
              </span>
            </div>
            {clipMovePreview.members?.map((m) => {
              return (
                <div
                  key={`float-${m.clipId}`}
                  className={cn(
                    "pointer-events-none fixed z-[35] flex items-center opacity-90 shadow-2xl will-change-[left]",
                    clipVisualClassName(m.trackKind, true),
                    validCls
                  )}
                  aria-hidden
                  style={{
                    left: clipMoveCyanLeft + (m.startTime - clipMovePreview.startTime) * pixelsPerSecond,
                    top: primaryTop + m.offsetY,
                    width: Math.max(24, m.duration * pixelsPerSecond),
                    height: m.trackKind === "main" ? 57.6 : 46.08,
                  }}
                >
                  <span className="min-w-0 truncate font-semibold leading-tight pointer-events-none">
                    {m.clipId}
                  </span>
                </div>
              );
            })}
          </>
        );
      })() : null}
      {marquee ? (
        <div
          className="pointer-events-none absolute z-50 border border-[var(--timeline-playhead)] bg-white/10"
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
