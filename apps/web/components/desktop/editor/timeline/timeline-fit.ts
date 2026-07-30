export const TIMELINE_INITIAL_CLIP_RATIO = 1 / 3;
export const TIMELINE_INITIAL_SPAN_FACTOR = 3;
export const TIMELINE_EMPTY_SPAN_SECONDS = 15;
export const TIMELINE_MIN_FIT_SPAN_SECONDS = 3;
export const TIMELINE_FIT_ZOOM_SCALE = 1;
export const ZOOM_OCTAVES = 4;

export function timelineFitSpanSeconds(anchorDuration: number): number {
  if (anchorDuration <= 0) return TIMELINE_EMPTY_SPAN_SECONDS;
  return Math.max(
    TIMELINE_MIN_FIT_SPAN_SECONDS,
    anchorDuration * TIMELINE_INITIAL_SPAN_FACTOR,
  );
}

export function fitPixelsPerSecond(
  contentViewportWidth: number,
  fitSpanSeconds: number,
): number {
  const safeWidth = Math.max(1, contentViewportWidth);
  const safeSpan = Math.max(0.1, fitSpanSeconds);
  return safeWidth / safeSpan;
}

export function timelineExtentSeconds(
  contentEndSeconds: number,
  fitSpanSeconds: number,
  visibleDurationSeconds: number,
  isFirstClipOnly: boolean,
): number {
  const trailingPaddingSeconds = isFirstClipOnly
    ? 0
    : Math.min(Math.max(fitSpanSeconds * 0.1, 1), 30);

  const contentExtentSeconds = contentEndSeconds + trailingPaddingSeconds;

  return Math.max(
    fitSpanSeconds,
    contentExtentSeconds,
    visibleDurationSeconds,
  );
}

export function sliderValueToZoomScale(value: number): number {
  const clamped = Math.min(100, Math.max(0, value));
  const normalized = (clamped - 50) / 50;
  return 2 ** (normalized * ZOOM_OCTAVES);
}

export function zoomScaleToSliderValue(scale: number): number {
  const safeScale = Math.max(0.0001, scale);
  const normalized = Math.log2(safeScale) / ZOOM_OCTAVES;
  const value = normalized * 50 + 50;
  return Math.min(100, Math.max(0, value));
}

export type TimelineClipLike = {
  startTime?: number;
  duration: number;
  laneId?: string;
};

export function resolveFitAnchorSeconds(
  clips: ReadonlyArray<TimelineClipLike>,
): number {
  if (!clips || clips.length === 0) {
    return TIMELINE_EMPTY_SPAN_SECONDS;
  }
  const sorted = [...clips].sort(
    (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0),
  );
  const first = sorted[0];
  return first && first.duration > 0
    ? first.duration
    : TIMELINE_EMPTY_SPAN_SECONDS;
}
