/** Timeline layout + CapCut ruler scale (desktop Vite — no apps/web imports). */

export const TIMELINE_ZOOM_MIN = 0;
export const TIMELINE_ZOOM_MAX = 100;
export const TIMELINE_ZOOM_DEFAULT = 50;

export const TIMELINE_LABEL_WIDTH = 96;
export const TIMELINE_PLAYHEAD_GUTTER_PX = 16;
export const TIMELINE_TRACKS_ORIGIN_X =
  TIMELINE_LABEL_WIDTH + TIMELINE_PLAYHEAD_GUTTER_PX;

export const BASE_LANE_HEIGHT_PX = 60;
export const SECONDARY_LANE_HEIGHT_PX = 48;

export function formatTimecode(totalSeconds: number, fps = 30): string {
  const safeFps = Math.max(1, Math.round(fps));
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

export function formatRulerLabel(
  totalFrames: number,
  fps: number,
  labelEveryFrames?: number,
): string {
  void labelEveryFrames;
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
  const totalMinutes = Math.floor(totalSecs / 60);
  return `${pad2(totalMinutes)}:${pad2(seconds)}`;
}

const TARGET_LABEL_PX = 160;
const MIN_TICK_GAP_PX = 8;
const PREFERRED_SUBDIVISIONS = [12, 10, 9, 5, 4, 2] as const;

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
    safeFps * 180,
    safeFps * 300,
    safeFps * 600,
  ]
    .filter((n, i, arr) => n >= 1 && arr.indexOf(n) === i)
    .sort((a, b) => a - b);

  return (
    candidates.find((n) => n >= minFrames) ??
    candidates[candidates.length - 1] ??
    1
  );
}

function tickStepForLabel(
  labelEveryFrames: number,
  pixelsPerFrame: number,
): number {
  const gapOk = (tickEvery: number, minPx: number) =>
    tickEvery >= 1 && tickEvery * pixelsPerFrame >= minPx;

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

export type CapCutRulerScale = {
  tickEveryFrames: number;
  labelEveryFrames: number;
  pixelsPerFrame: number;
};

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

export function laneRowHeightPx(lane: {
  kind: string;
  role?: string;
}): number {
  if (lane.kind === "visual" && lane.role === "base") {
    return BASE_LANE_HEIGHT_PX;
  }
  return SECONDARY_LANE_HEIGHT_PX;
}
