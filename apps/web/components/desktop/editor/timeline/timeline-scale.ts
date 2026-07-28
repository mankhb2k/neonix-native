export function formatTimecode(totalSeconds: number, fps = 30): string {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.round(totalSeconds * safeFps));
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
 * CapCut ruler label:
 * - whole second → `HH:MM:SS` when zoomed into frames, else `MM:SS`
 * - mid-second   → `5f` / `15f` (frame index within that second)
 */
export function formatRulerLabel(
  totalFrames: number,
  fps: number,
  labelEveryFrames: number,
): string {
  const safeFps = Math.max(1, Math.round(fps));
  const frame = Math.max(0, Math.round(totalFrames));
  const frameInSecond = frame % safeFps;

  if (frameInSecond === 0) {
    const totalSecs = Math.floor(frame / safeFps);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (labelEveryFrames < safeFps) {
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    }
    if (hours > 0) {
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    }
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${frameInSecond}f`;
}

export const TIMELINE_LABEL_WIDTH = 96;
export const TIMELINE_ZOOM_MIN = 0;
export const TIMELINE_ZOOM_MAX = 100;
export const TIMELINE_ZOOM_DEFAULT = 0;
/**
 * CapCut min workspace ≈ duration video đầu × hệ số
 * (23s → ~1:30, 2ph → ~8ph).
 */
export const TIMELINE_MIN_SPAN_FACTOR = 4;
/** Floor pps khi chưa đo viewport. */
export const TIMELINE_PPS_MIN = 1.5;
/**
 * CapCut max: ~9 frame chiếm hết ngang viewport.
 * Fallback khi chưa đo được width (≈120px/frame @30fps).
 */
export const TIMELINE_FRAMES_AT_MAX_ZOOM = 9;
export const TIMELINE_PPS_MAX = 3600;
/** Khoảng cách tối thiểu giữa 2 nhãn (px). */
const TARGET_LABEL_PX = 96;
/** Chỉ vẽ tick khi cách nhau ≥ mức này (px) — tránh rừng vạch. */
const MIN_TICK_GAP_PX = 9;

/**
 * Zoom 0 = workspace (total content × 4, min 20s) vừa viewport,
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

/** Workspace = max(total × 4, 20s) — floor ≈ 4× một khung 5s. */
export function timelineWorkspaceSeconds(contentSeconds: number): number {
  const content = Math.max(0, contentSeconds);
  return Math.max(content * TIMELINE_MIN_SPAN_FACTOR, 20);
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

/** Độ dài canvas thước: max(workspace, đủ phủ viewport). */
export function timelineCanvasDuration(
  contentSeconds: number,
  pixelsPerSecond: number,
  trackViewWidth: number,
): number {
  const viewportSeconds =
    trackViewWidth > 0 && pixelsPerSecond > 0
      ? trackViewWidth / pixelsPerSecond
      : 0;
  return Math.max(timelineWorkspaceSeconds(contentSeconds), viewportSeconds);
}

export type CapCutRulerScale = {
  /** Draw a tick every N frames. */
  tickEveryFrames: number;
  /** Draw a label + major tick every N frames. */
  labelEveryFrames: number;
  pixelsPerFrame: number;
};

/** Snap to CapCut-like intervals (1,2,5,10,15,½s,1s,2s,5s,…). */
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
    safeFps * 5,
    safeFps * 10,
    safeFps * 15,
    safeFps * 30,
    safeFps * 60,
    safeFps * 120,
    safeFps * 300,
  ]
    .filter((n, i, arr) => n >= 1 && arr.indexOf(n) === i)
    .sort((a, b) => a - b);

  return candidates.find((n) => n >= minFrames) ?? candidates[candidates.length - 1]!;
}

/**
 * CapCut zoom math: nhãn thưa (~96px), tick từng frame chỉ khi mỗi frame ≥ ~9px.
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

  const minFramesForTick = Math.max(
    1,
    MIN_TICK_GAP_PX / Math.max(pixelsPerFrame, 0.001),
  );
  let tickEveryFrames = niceFrameStep(minFramesForTick, safeFps);
  if (tickEveryFrames > labelEveryFrames) {
    tickEveryFrames = labelEveryFrames;
  }
  // Subdivide labels when room allows (CapCut: vạch nhỏ giữa các nhãn).
  if (labelEveryFrames >= 5 && tickEveryFrames === labelEveryFrames) {
    const subdivided = niceFrameStep(labelEveryFrames / 5, safeFps);
    if (subdivided * pixelsPerFrame >= MIN_TICK_GAP_PX) {
      tickEveryFrames = subdivided;
    }
  }

  return { tickEveryFrames, labelEveryFrames, pixelsPerFrame };
}
