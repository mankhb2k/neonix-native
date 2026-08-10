import type { TimelineLane } from "../model/timeline-types";

// ── Config ──────────────────────────────────────────────────────────

export type LaneRowConfig = {
  baseHeight: number;
  secondaryHeight: number;
  layerHeight: number;
  layerVideoHeight: number;
  gapPx: number;
  topPaddingPx: number;
  bottomPaddingPx: number;
};

// ── Generic row shape — apps extend with styling fields ─────────────

export type GenericLaneRow = {
  lane: TimelineLane;
  kind: "visual" | "audio";
  role: "base" | "overlay" | "audio";
  order: number;
  height: number;
};

// ── Sort helpers ────────────────────────────────────────────────────

/**
 * CapCut order: overlays (desc) → base → audios (asc).
 * Returns the lanes in display order without assigning heights.
 */
export function sortLanesOverlayBaseAudio(
  lanes: ReadonlyArray<TimelineLane>,
): TimelineLane[] {
  const overlays = lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .sort((a, b) => b.order - a.order);
  const base = lanes
    .filter((l) => l.kind === "visual" && l.role === "base")
    .sort((a, b) => a.order - b.order);
  const audio = lanes
    .filter((l) => l.kind === "audio")
    .sort((a, b) => a.order - b.order);
  return [...overlays, ...base, ...audio];
}

// ── Row builder ─────────────────────────────────────────────────────

/** Assign heights (from config) to each sorted lane and return GenericLaneRow[]. */
export function buildLaneRows(
  lanes: ReadonlyArray<TimelineLane>,
  config: LaneRowConfig,
): GenericLaneRow[] {
  const sorted = sortLanesOverlayBaseAudio(lanes);
  return sorted.map((lane) => {
    let height: number;
    if (lane.kind === "audio") {
      height = config.secondaryHeight;
    } else if (lane.role === "base") {
      height = config.baseHeight;
    } else {
      // overlay visual
      height = config.secondaryHeight;
    }
    return {
      lane,
      kind: lane.kind,
      role: lane.role,
      order: lane.order,
      height,
    };
  });
}

// ── Stack / content height ──────────────────────────────────────────

/** Lane stack height without outer padding. */
export function timelineLanesStackHeight(
  rows: ReadonlyArray<GenericLaneRow>,
): number {
  if (rows.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i]!.height;
    if (i < rows.length - 1) sum += 2; // generic gap — caller can override
  }
  return sum;
}

/** Stack height with named gap from config. */
export function timelineLanesStackHeightWithGap(
  rows: ReadonlyArray<GenericLaneRow>,
  config: LaneRowConfig,
): number {
  if (rows.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i]!.height;
    if (i < rows.length - 1) sum += config.gapPx;
  }
  return sum;
}

/** Content height including top/bottom padding and gaps between rows. */
export function timelineLanesContentHeight(
  rows: ReadonlyArray<GenericLaneRow>,
  config: LaneRowConfig,
): number {
  if (rows.length === 0) {
    return config.topPaddingPx + config.bottomPaddingPx;
  }
  let sum = config.topPaddingPx + config.bottomPaddingPx;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i]!.height;
    if (i < rows.length - 1) sum += config.gapPx;
  }
  return sum;
}

// ── Vertical insets ─────────────────────────────────────────────────

/**
 * CapCut-style vertical insets: keep ≥min padding, and when the viewport is
 * taller than the stack, split leftover into top/bottom so the band sits middle.
 */
export function timelineVerticalInsets(
  rows: ReadonlyArray<GenericLaneRow>,
  viewHeight: number,
  config: LaneRowConfig,
): { top: number; bottom: number; contentHeight: number } {
  const stack = timelineLanesStackHeightWithGap(rows, config);
  const minContent = stack + config.topPaddingPx + config.bottomPaddingPx;
  const contentHeight = Math.max(minContent, Math.max(0, viewHeight), 1);
  const leftover = Math.max(0, contentHeight - stack);
  const top = Math.max(config.topPaddingPx, Math.floor(leftover / 2));
  const bottom = Math.max(config.bottomPaddingPx, leftover - top);
  return { top, bottom, contentHeight };
}

// ── Per-lane helpers ────────────────────────────────────────────────

/** Y offset of lane index within content (after top padding). */
export function laneContentOffsetTop(
  rows: ReadonlyArray<GenericLaneRow>,
  laneIndex: number,
  config: LaneRowConfig,
): number {
  let top = config.topPaddingPx;
  for (let i = 0; i < laneIndex; i += 1) {
    top += rows[i]!.height + config.gapPx;
  }
  return top;
}

/** Heights array for virtualization (gaps as spacer entries). */
export function laneHeightsWithGaps(
  rows: ReadonlyArray<GenericLaneRow>,
  config: LaneRowConfig,
): number[] {
  const heights: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    heights.push(rows[i]!.height);
    if (i < rows.length - 1) heights.push(config.gapPx);
  }
  return heights;
}
