export function formatTimecode(totalSeconds: number, fps = 30): string {
  const safeFps = Math.max(1, Math.round(fps));
  // Floor (not round) — same rule as preview frameIndex / quantizeTimeToFrame.
  const totalFrames = Math.max(
    0,
    Math.floor(Math.max(0, totalSeconds) * safeFps + Number.EPSILON * 8),
  );
  const frames = totalFrames % safeFps;
  const totalSecs = Math.floor(totalFrames / safeFps);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return [hours, minutes, seconds, frames]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * CapCut ruler label — always **two fields** phút:giây (`MM:SS`),
 * e.g. `03:00` = 3 phút, `18:00` = 18 phút. Zoom sâu mới dùng `15f`.
 */
export function formatRulerLabel(
  totalFrames: number,
  fps: number,
  _labelEveryFrames: number,
): string {
  const safeFps = Math.max(1, Math.round(fps));
  const frame = Math.max(0, Math.round(totalFrames));
  const frameInSecond = frame % safeFps;

  if (frameInSecond !== 0) {
    return `${frameInSecond}f`;
  }

  const totalSecs = Math.floor(frame / safeFps);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  // CapCut: MM:SS (phút:giây) — 18:00 = 18 phút
  const totalMinutes = Math.floor(totalSecs / 60);
  return `${pad2(totalMinutes)}:${pad2(seconds)}`;
}

export const TIMELINE_LABEL_WIDTH = 96;
export const TIMELINE_ZOOM_MIN = 0;
export const TIMELINE_ZOOM_MAX = 100;
export const TIMELINE_ZOOM_DEFAULT = 0;
/**
 * CapCut min workspace ≈ duration × hệ số; floor ~18 phút khi zoom out tối đa
 * (screenshot CapCut: nhãn tới 18:00).
 */
export const TIMELINE_MIN_SPAN_FACTOR = 4;
/** CapCut empty/min zoom: viewport covers ~18 minutes. */
export const TIMELINE_MIN_WORKSPACE_SECONDS = 18 * 60;
/** Floor pps khi chưa đo viewport. */
export const TIMELINE_PPS_MIN = 1.5;
/**
 * CapCut max: ~9 frame chiếm hết ngang viewport.
 * Fallback khi chưa đo được width (≈120px/frame @30fps).
 */
export const TIMELINE_FRAMES_AT_MAX_ZOOM = 9;
export const TIMELINE_PPS_MAX = 3600;
/**
 * CapCut ruler is airy: ~160px between majors at min zoom → bước 3 phút.
 */
const TARGET_LABEL_PX = 160;
/** Chỉ vẽ tick khi cách nhau ≥ mức này (px) — tránh rừng vạch. */
const MIN_TICK_GAP_PX = 8;
/**
 * CapCut zoom-out: 3 phút → **12 ô** (11 vạch nhỏ).
 * Ưu tiên 12 trước 10 (10 ô = 9 vạch — lệch CapCut).
 */
const PREFERRED_SUBDIVISIONS = [12, 10, 9, 5, 4, 2] as const;

/**
 * Zoom 0 = workspace (~18 phút min) vừa viewport,
 * Zoom 100 = ~9 frame đầy ngang (CapCut max).
 */
export function zoomToPixelsPerSecond(
  zoom: number,
  minPixelsPerSecond = TIMELINE_PPS_MIN,
  maxPixelsPerSecond = TIMELINE_PPS_MAX,
): number {
  const minPps = Math.max(TIMELINE_PPS_MIN, minPixelsPerSecond);
  const maxPps = Math.max(minPps * 1.05, maxPixelsPerSecond);
  const t = Math.min(1, Math.max(0, zoom / TIMELINE_ZOOM_MAX));
  return minPps * Math.pow(maxPps / minPps, t);
}

/** pps max để ~N frame vừa track viewport. */
export function maxPixelsPerSecondForView(
  trackViewWidth: number,
  fps: number,
): number {
  if (trackViewWidth <= 0) return TIMELINE_PPS_MAX;
  const safeFps = Math.max(1, Math.round(fps));
  return (trackViewWidth / TIMELINE_FRAMES_AT_MAX_ZOOM) * safeFps;
}

/** Workspace = max(content × 4, ~18 phút) — khớp CapCut zoom out. */
export function timelineWorkspaceSeconds(contentSeconds: number): number {
  const content = Math.max(0, contentSeconds);
  return Math.max(
    content * TIMELINE_MIN_SPAN_FACTOR,
    TIMELINE_MIN_WORKSPACE_SECONDS,
  );
}

/**
 * End of editable timeline content (CapCut: playhead cannot pass last clip).
 * Main = sum of scene durations; overlays = max(start + duration).
 */
export function timelineContentEndSeconds(
  scenes: ReadonlyArray<{ duration: number }>,
  overlays: ReadonlyArray<{ startTime: number; duration: number }> = [],
): number {
  const mainEnd = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  let overlayEnd = 0;
  for (const item of overlays) {
    overlayEnd = Math.max(overlayEnd, item.startTime + item.duration);
  }
  return Math.max(mainEnd, overlayEnd, 0);
}

/** Độ dài canvas thước: zoom out giữ ~18 phút; zoom in thu về content để tránh DOM khổng lồ. */
export function timelineCanvasDuration(
  contentSeconds: number,
  pixelsPerSecond: number,
  trackViewWidth: number,
  zoom = TIMELINE_ZOOM_DEFAULT,
): number {
  const viewportSeconds =
    trackViewWidth > 0 && pixelsPerSecond > 0
      ? trackViewWidth / pixelsPerSecond
      : 0;
  const workspace = timelineWorkspaceSeconds(contentSeconds);
  const contentPad = Math.max(contentSeconds + 30, viewportSeconds);
  // Past ~25% zoom, full 18-minute × high pps creates multi‑100k px layouts (lag).
  if (zoom >= 25) {
    return Math.max(contentPad, viewportSeconds);
  }
  return Math.max(workspace, viewportSeconds);
}

export type CapCutRulerScale = {
  /** Draw a tick every N frames. */
  tickEveryFrames: number;
  /** Draw a label + major tick every N frames. */
  labelEveryFrames: number;
  pixelsPerFrame: number;
};

/** Snap to CapCut-like intervals (3s…3 phút majors at min zoom). */
function niceFrameStep(minFrames: number, fps: number): number {
  const safeFps = Math.max(1, Math.round(fps));
  const candidates = [
    1,
    2,
    5,
    10,
    Math.round(safeFps / 2),
    safeFps,
    safeFps * 2,
    safeFps * 3,
    safeFps * 5,
    safeFps * 10,
    safeFps * 15,
    safeFps * 30,
    safeFps * 60,
    safeFps * 120,
    safeFps * 180, // 3 phút — CapCut zoom out
    safeFps * 300,
    safeFps * 600,
  ]
    .filter((n, i, arr) => n >= 1 && arr.indexOf(n) === i)
    .sort((a, b) => a - b);

  return candidates.find((n) => n >= minFrames) ?? candidates[candidates.length - 1]!;
}

/**
 * CapCut: equal minor ticks between majors.
 * Force 12-way split when label is a multi-minute CapCut step (e.g. 3 phút)
 * so we always get 11 minor ticks — not 9 from falling back to 10.
 */
function tickStepForLabel(
  labelEveryFrames: number,
  pixelsPerFrame: number,
): number {
  const gapOk = (tickEvery: number, minPx: number) =>
    tickEvery >= 1 && tickEvery * pixelsPerFrame >= minPx;

  // CapCut desktop: 3-minute majors → exactly 12 slots (15s).
  if (labelEveryFrames % 12 === 0) {
    const by12 = labelEveryFrames / 12;
    if (gapOk(by12, 6)) return by12;
  }

  for (const divisions of PREFERRED_SUBDIVISIONS) {
    if (labelEveryFrames % divisions !== 0) continue;
    const tickEvery = labelEveryFrames / divisions;
    if (gapOk(tickEvery, MIN_TICK_GAP_PX)) return tickEvery;
  }
  return labelEveryFrames;
}

/**
 * CapCut zoom math: nhãn thoáng (~128px), giữa hai nhãn chia đều (ưu tiên 10/9 ô).
 */
export function capCutRulerScale(
  pixelsPerSecond: number,
  fps: number,
): CapCutRulerScale {
  const safeFps = Math.max(1, Math.round(fps));
  const pixelsPerFrame = pixelsPerSecond / safeFps;
  const minFramesForLabel = Math.max(
    1,
    TARGET_LABEL_PX / Math.max(pixelsPerFrame, 0.001),
  );
  const labelEveryFrames = niceFrameStep(minFramesForLabel, safeFps);
  const tickEveryFrames = tickStepForLabel(labelEveryFrames, pixelsPerFrame);

  return { tickEveryFrames, labelEveryFrames, pixelsPerFrame };
}
