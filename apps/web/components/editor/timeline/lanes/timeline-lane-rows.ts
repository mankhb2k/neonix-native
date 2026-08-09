import type { TimelineLane } from "@motionvideo/editor-core";
import {
  buildLaneRows,
  timelineVerticalInsets as timelineVerticalInsetsCore,
  timelineLanesStackHeightWithGap as timelineLanesStackHeightCore,
  type GenericLaneRow,
  type LaneRowConfig,
} from "@motionvideo/editor-core";
import {
  BASE_LANE_HEIGHT_PX,
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
  LANE_GAP_PX,
  SECONDARY_LANE_HEIGHT_PX,
  TIMELINE_BOTTOM_PADDING_PX,
  TIMELINE_TOP_PADDING_PX,
} from "../timeline-scale";

// ── Web chrome config ───────────────────────────────────────────────

export const webLaneRowConfig: LaneRowConfig = {
  baseHeight: BASE_LANE_HEIGHT_PX,
  secondaryHeight: SECONDARY_LANE_HEIGHT_PX,
  layerHeight: LAYER_LANE_HEIGHT_PX,
  layerVideoHeight: LAYER_VIDEO_LANE_HEIGHT_PX,
  gapPx: LANE_GAP_PX,
  topPaddingPx: TIMELINE_TOP_PADDING_PX,
  bottomPaddingPx: TIMELINE_BOTTOM_PADDING_PX,
};

// ── Compatibility types ─────────────────────────────────────────────

export type LaneRow = TimelineLane & {
  height: number;
};

// ── Thin adapters — delegate to editor-core ─────────────────────────

/** CapCut order: overlays (desc) → base → audios (asc). */
export function buildTrackLaneRows(lanes: TimelineLane[]): LaneRow[] {
  const rows = buildLaneRows(lanes, webLaneRowConfig);
  return rows.map(
    (r) =>
      ({
        ...r.lane,
        height: r.height,
        kind: r.kind,
        role: r.role,
        order: r.order,
      }) as LaneRow,
  );
}

/** Layer mode: compact rows (first = video-ish) — web-specific. */
export function buildLayerLaneRows(lanes: TimelineLane[]): LaneRow[] {
  return [...lanes]
    .sort((a, b) => a.order - b.order)
    .map((l, i) => ({
      ...l,
      height: i === 0 ? LAYER_VIDEO_LANE_HEIGHT_PX : LAYER_LANE_HEIGHT_PX,
    }));
}

/** Lane stack height without outer padding. */
export function timelineLanesStackHeight(rows: readonly LaneRow[]): number {
  const genericRows: GenericLaneRow[] = rows.map((r) => ({
    lane: r,
    kind: r.kind,
    role: r.role,
    order: r.order,
    height: r.height,
  }));
  return timelineLanesStackHeightCore(genericRows, webLaneRowConfig);
}

/**
 * CapCut-style vertical insets: keep ≥min padding, and when the viewport is
 * taller than the stack, split leftover into top/bottom so the band sits middle.
 */
export function timelineVerticalInsets(
  rows: readonly LaneRow[],
  viewHeight: number,
): { top: number; bottom: number; contentHeight: number } {
  const genericRows: GenericLaneRow[] = rows.map((r) => ({
    lane: r,
    kind: r.kind,
    role: r.role,
    order: r.order,
    height: r.height,
  }));
  return timelineVerticalInsetsCore(genericRows, viewHeight, webLaneRowConfig);
}

// Re-export core helpers for convenience
export {
  timelineLanesContentHeight,
  laneContentOffsetTop,
  laneHeightsWithGaps,
} from "@motionvideo/editor-core";
