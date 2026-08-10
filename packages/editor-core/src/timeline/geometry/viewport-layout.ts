/**
 * Pure viewport layout metrics — shared by web & desktop.
 * Web callers convert `zoomSlider → zoomScale` via `sliderValueToZoomScale` before calling.
 */

import {
  fitPixelsPerSecond,
  resolveFitAnchorSeconds,
  timelineExtentSeconds,
  timelineFitSpanSeconds,
} from "../policies/zoom-fit-policy";
import { clipsContentEndSeconds } from "../timeline-clips";
import type { TimelineClip } from "../model/timeline-types";

export type ViewportLayoutInput = {
  clips: TimelineClip[];
  trackViewWidth: number;
  /** Already resolved zoom scale (web: sliderValueToZoomScale(zoomSlider), desktop: direct). */
  timelineZoomScale: number;
  timelineFitAnchorSeconds?: number | null;
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
