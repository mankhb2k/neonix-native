/**
 * Pure viewport layout metrics (slice 1) — testable without DOM.
 */

import {
  clipsContentEndSeconds,
  fitPixelsPerSecond,
  resolveFitAnchorSeconds,
  timelineExtentSeconds,
  timelineFitSpanSeconds,
  type TimelineClip,
} from "@motionvideo/editor-core";

export type ViewportLayoutInput = {
  clips: TimelineClip[];
  trackViewWidth: number;
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
};

export type ViewportLayout = {
  contentEnd: number;
  fitSpan: number;
  fitPps: number;
  pixelsPerSecond: number;
  extentSeconds: number;
  canvasWidth: number;
};

export function computeViewportLayout(
  input: ViewportLayoutInput,
): ViewportLayout {
  const contentEnd = clipsContentEndSeconds(input.clips);
  const anchorSeconds =
    input.timelineFitAnchorSeconds ?? resolveFitAnchorSeconds(input.clips);
  const fitSpan = timelineFitSpanSeconds(anchorSeconds);
  const fitPps = fitPixelsPerSecond(input.trackViewWidth, fitSpan);
  const pixelsPerSecond = fitPps * input.timelineZoomScale;
  const visibleDuration =
    input.trackViewWidth > 0
      ? input.trackViewWidth / Math.max(pixelsPerSecond, 0.001)
      : fitSpan;
  const isFirstClip = input.clips.length <= 1;
  const extentSeconds = timelineExtentSeconds(
    contentEnd,
    fitSpan,
    visibleDuration,
    isFirstClip,
  );
  const canvasWidth = Math.max(
    input.trackViewWidth,
    extentSeconds * pixelsPerSecond,
  );

  return {
    contentEnd,
    fitSpan,
    fitPps,
    pixelsPerSecond,
    extentSeconds,
    canvasWidth,
  };
}
