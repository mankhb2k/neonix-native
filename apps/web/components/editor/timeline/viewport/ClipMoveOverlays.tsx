"use client";

import type { ClipMovePreview } from "@motionvideo/editor-interactions";

import {
  clipStripHeightPx,
  SECONDARY_LANE_HEIGHT_PX,
  TIMELINE_START_GUTTER_PX,
} from "../timeline-scale";
import {
  TimelineClipFloat,
  visualKindFromTrack,
} from "./TimelineClipFloat";

type Props = {
  preview: ClipMovePreview | null;
  pixelsPerSecond: number;
  contentWidth: number;
  contentHeight: number;
  /** `getBoundingClientRect().left` of the timeline scroller (measured in the parent). */
  viewportClientLeft: number;
  scrollLeft: number;
};

/**
 * Clip-move chrome — ghost + insert/snap + **float**.
 * Ghost/insert live in scroll-content coords; float is `position: fixed` (pointer Y).
 */
export function ClipMoveOverlays({
  preview,
  pixelsPerSecond,
  contentWidth,
  contentHeight,
  viewportClientLeft,
  scrollLeft,
}: Props) {
  if (!preview) return null;

  const ghostLeft =
    TIMELINE_START_GUTTER_PX + preview.startTime * pixelsPerSecond;
  const ghostWidth = Math.max(24, preview.duration * pixelsPerSecond);
  const dropFamily = preview.trackKind === "audio" ? "audio" : "visual";

  const floatH = clipStripHeightPx(
    preview.laneHeightPx ?? SECONDARY_LANE_HEIGHT_PX,
  );
  const floatLeft =
    preview.clientY != null
      ? viewportClientLeft +
        TIMELINE_START_GUTTER_PX +
        preview.startTime * pixelsPerSecond -
        scrollLeft
      : null;
  const floatTop =
    preview.clientY != null
      ? preview.clientY - (preview.grabOffsetY ?? floatH / 2)
      : null;

  return (
    <>
      {preview.valid && preview.isInsert && preview.contentTop != null ? (
        <>
          <div
            className="pointer-events-none absolute z-[30] h-8 -translate-y-1/2 overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md"
            aria-hidden
            data-testid="timeline-clip-move-ghost"
            style={{
              top: preview.contentTop,
              left: ghostLeft,
              width: ghostWidth,
            }}
          />
          <div
            data-testid="timeline-insert-indicator"
            data-clip-insert-indicator="true"
            data-drop-family={dropFamily}
            className="pointer-events-none absolute z-[30] h-px bg-[#14B8A6]"
            aria-hidden
            style={{
              top: preview.contentTop,
              left: 0,
              width: contentWidth,
            }}
          />
        </>
      ) : null}
      {preview.snapGuideTime != null ? (
        <div
          data-testid="timeline-clip-snap-guide"
          className="pointer-events-none absolute top-0 z-[32] w-px bg-[#14B8A6]"
          aria-hidden
          style={{
            left:
              TIMELINE_START_GUTTER_PX +
              preview.snapGuideTime * pixelsPerSecond,
            height: contentHeight,
          }}
        />
      ) : null}
      {floatLeft != null && floatTop != null ? (
        <>
          <TimelineClipFloat
            visualKind={visualKindFromTrack(preview.trackKind)}
            label={preview.label || preview.clipId}
            left={floatLeft}
            top={floatTop}
            width={ghostWidth}
            height={floatH}
            valid={preview.valid}
            showTrimHandles
          />
          {preview.members?.map((member) => (
            <TimelineClipFloat
              key={`float-${member.clipId}`}
              visualKind={visualKindFromTrack(member.trackKind)}
              label={member.clipId}
              left={
                floatLeft +
                (member.startTime - preview.startTime) * pixelsPerSecond
              }
              top={floatTop + member.offsetY}
              width={Math.max(24, member.duration * pixelsPerSecond)}
              height={clipStripHeightPx(
                member.laneHeightPx ??
                  preview.laneHeightPx ??
                  SECONDARY_LANE_HEIGHT_PX,
              )}
              valid={preview.valid}
              showTrimHandles
            />
          ))}
        </>
      ) : null}
    </>
  );
}
