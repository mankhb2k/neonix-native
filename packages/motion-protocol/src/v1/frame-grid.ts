/**
 * Lưới khung — snap và kiểm thời gian cây layer về n / fps.
 */
import type { AudioLayerV1 } from "./layers/audio";
import type { LayerV1 } from "./layers";

const FRAME_GRID_EPSILON = 1e-9;

export function secondsToFrameIndex(seconds: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  return Math.round(seconds * safeFps);
}

export function snapSecondsToFrameGrid(seconds: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  return secondsToFrameIndex(seconds, safeFps) / safeFps;
}

export function isOnFrameGrid(seconds: number, fps: number): boolean {
  const safeFps = Math.max(1, fps);
  const scaled = seconds * safeFps;
  return Math.abs(scaled - Math.round(scaled)) <= FRAME_GRID_EPSILON;
}

export interface FrameGridIssue {
  path: (string | number)[];
  message: string;
  value: number;
  expected: number;
}

function checkOnGrid(
  value: number | undefined,
  fps: number,
  path: (string | number)[],
  issues: FrameGridIssue[],
): void {
  if (value === undefined || !Number.isFinite(value)) return;
  if (isOnFrameGrid(value, fps)) return;
  const expected = snapSecondsToFrameGrid(value, fps);
  issues.push({
    path,
    message: `Value ${value} is off the ${fps}fps frame grid (expected ${expected})`,
    value,
    expected,
  });
}

function snapOptional(
  value: number | undefined,
  fps: number,
): number | undefined {
  if (value === undefined) return undefined;
  return snapSecondsToFrameGrid(value, fps);
}

function snapLayerNode(layer: LayerV1, fps: number): LayerV1 {
  const timing = layer.timing
    ? {
        ...layer.timing,
        start: snapSecondsToFrameGrid(layer.timing.start, fps),
        duration: snapSecondsToFrameGrid(layer.timing.duration, fps),
      }
    : layer.timing;

  if (layer.type === "audio") {
    const payload: AudioLayerV1["payload"] = {
      ...layer.payload,
      trimStart: snapSecondsToFrameGrid(layer.payload.trimStart, fps),
      trimEnd: snapOptional(layer.payload.trimEnd, fps),
      fadeIn: snapSecondsToFrameGrid(layer.payload.fadeIn, fps),
      fadeOut: snapSecondsToFrameGrid(layer.payload.fadeOut, fps),
    };
    return {
      ...layer,
      timing: {
        start: snapSecondsToFrameGrid(layer.timing.start, fps),
        duration: snapSecondsToFrameGrid(layer.timing.duration, fps),
      },
      payload,
    };
  }

  if (layer.type === "group") {
    return {
      ...layer,
      timing,
      children: (layer.children ?? []).map((child) => snapLayerNode(child, fps)),
    };
  }

  return { ...layer, timing };
}

export function snapLayerTreeToFrameGrid(
  layers: LayerV1[],
  fps: number,
): LayerV1[] {
  const safeFps = Math.max(1, fps);
  return layers.map((layer) => snapLayerNode(layer, safeFps));
}

function collectLayerFrameGridIssues(
  layers: readonly LayerV1[],
  fps: number,
  prefix: (string | number)[],
  issues: FrameGridIssue[],
): void {
  for (const layer of layers) {
    const base = [...prefix, layer.id] as (string | number)[];
    if (layer.timing) {
      checkOnGrid(layer.timing.start, fps, [...base, "timing", "start"], issues);
      checkOnGrid(
        layer.timing.duration,
        fps,
        [...base, "timing", "duration"],
        issues,
      );
    }
    if (layer.type === "audio") {
      checkOnGrid(
        layer.payload.trimStart,
        fps,
        [...base, "payload", "trimStart"],
        issues,
      );
      checkOnGrid(
        layer.payload.trimEnd,
        fps,
        [...base, "payload", "trimEnd"],
        issues,
      );
      checkOnGrid(
        layer.payload.fadeIn,
        fps,
        [...base, "payload", "fadeIn"],
        issues,
      );
      checkOnGrid(
        layer.payload.fadeOut,
        fps,
        [...base, "payload", "fadeOut"],
        issues,
      );
    }
    if (layer.type === "group") {
      collectLayerFrameGridIssues(
        layer.children,
        fps,
        base.concat("children"),
        issues,
      );
    }
  }
}

/** Thu thập lỗi timing lệch frame-grid cho cây layer. */
export function collectFrameGridIssues(
  fps: number,
  layers: readonly LayerV1[] = [],
): FrameGridIssue[] {
  const issues: FrameGridIssue[] = [];
  collectLayerFrameGridIssues(layers, Math.max(1, fps), ["layers"], issues);
  return issues;
}
