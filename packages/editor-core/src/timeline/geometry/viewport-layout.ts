/**
 * Pure viewport layout metrics — dùng chung web & desktop.
 * Web caller đổi `zoomSlider → zoomScale` qua `sliderValueToZoomScale` trước khi gọi.
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
  /** zoom scale đã resolve (web: sliderValueToZoomScale(zoomSlider), desktop: trực tiếp). */
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
  // `undefined` means this caller delegates to the default clip-derived fit
  // policy. `null` is deliberate: it locks an initially empty project to the
  // default time window while new clips are added.
  const anchorSeconds =
    input.timelineFitAnchorSeconds === undefined
      ? resolveFitAnchorSeconds(input.clips)
      : input.timelineFitAnchorSeconds;
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
