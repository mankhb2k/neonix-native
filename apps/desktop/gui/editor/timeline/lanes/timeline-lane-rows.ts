import type { TimelineLane } from "@motionvideo/editor-core";
import {
  buildLaneRows,
  timelineVerticalInsets as timelineVerticalInsetsCore,
  timelineLanesStackHeightWithGap as timelineLanesStackHeightCore,
  timelineLanesContentHeight as timelineLanesContentHeightCore,
  laneContentOffsetTop as laneContentOffsetTopCore,
  laneHeightsWithGaps as laneHeightsWithGapsCore,
  type GenericLaneRow,
  type LaneRowConfig,
} from "@motionvideo/editor-core";
import {
  BASE_LANE_HEIGHT_PX,
  SECONDARY_LANE_HEIGHT_PX,
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
} from "../timeline-scale";

export {
  BASE_LANE_HEIGHT_PX,
  SECONDARY_LANE_HEIGHT_PX,
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
};
export const LANE_GAP_PX = 2;
export const TIMELINE_TOP_PADDING_PX = 40;
export const TIMELINE_BOTTOM_PADDING_PX = 40;

// ── Desktop chrome config ───────────────────────────────────────────

const desktopLaneRowConfig: LaneRowConfig = {
  baseHeight: BASE_LANE_HEIGHT_PX,
  secondaryHeight: SECONDARY_LANE_HEIGHT_PX,
  layerHeight: LAYER_LANE_HEIGHT_PX,
  layerVideoHeight: LAYER_VIDEO_LANE_HEIGHT_PX,
  gapPx: LANE_GAP_PX,
  topPaddingPx: TIMELINE_TOP_PADDING_PX,
  bottomPaddingPx: TIMELINE_BOTTOM_PADDING_PX,
};

// ── Desktop row shape ───────────────────────────────────────────────

export type TimelineLaneRow = {
  id: string;
  kind: "visual" | "audio";
  role: "base" | "overlay" | "audio";
  order: number;
  name?: string;
  height: number;
  heightClass: string;
  lane: TimelineLane;
};

/** Map a GenericLaneRow from core → desktop's TimelineLaneRow. */
function toDesktopRow(r: GenericLaneRow): TimelineLaneRow {
  return {
    id: r.lane.id,
    kind: r.kind,
    role: r.role,
    order: r.order,
    name: r.lane.name,
    height: r.height,
    heightClass: "h-12",
    lane: r.lane,
  };
}

// ── Thin adapters — delegate to editor-core ─────────────────────────

/** Web order: overlays (desc) → main/base → audios (asc). */
export function buildTimelineLaneRows(
  timelineLanes: ReadonlyArray<TimelineLane>,
): TimelineLaneRow[] {
  return buildLaneRows(timelineLanes, desktopLaneRowConfig).map(toDesktopRow);
}

/** Content height including top/bottom padding and gaps between rows. */
export function timelineLanesContentHeight(
  rows: readonly TimelineLaneRow[],
): number {
  const genericRows: GenericLaneRow[] = rows.map(toGenericRow);
  return timelineLanesContentHeightCore(genericRows, desktopLaneRowConfig);
}

/** Lane stack height without outer padding. */
export function timelineLanesStackHeight(
  rows: readonly TimelineLaneRow[],
): number {
  const genericRows: GenericLaneRow[] = rows.map(toGenericRow);
  return timelineLanesStackHeightCore(genericRows, desktopLaneRowConfig);
}

/**
 * CapCut-style vertical insets: keep ≥40px padding, and when the viewport is
 * taller than the stack, push leftover space into top/bottom so the band sits
 * near the middle of the timeline.
 */
export function timelineVerticalInsets(
  rows: readonly TimelineLaneRow[],
  viewHeight: number,
): { top: number; bottom: number; contentHeight: number } {
  const genericRows: GenericLaneRow[] = rows.map(toGenericRow);
  return timelineVerticalInsetsCore(
    genericRows,
    viewHeight,
    desktopLaneRowConfig,
  );
}

/** Y offset of lane index within content (after top padding). */
export function laneContentOffsetTop(
  rows: readonly TimelineLaneRow[],
  laneIndex: number,
): number {
  const genericRows: GenericLaneRow[] = rows.map(toGenericRow);
  return laneContentOffsetTopCore(genericRows, laneIndex, desktopLaneRowConfig);
}

/** Heights array for virtualization (padding as fake spacers not included — caller adds padding). */
export function laneHeightsWithGaps(
  rows: readonly TimelineLaneRow[],
): number[] {
  const genericRows: GenericLaneRow[] = rows.map(toGenericRow);
  return laneHeightsWithGapsCore(genericRows, desktopLaneRowConfig);
}

// ── Helpers ─────────────────────────────────────────────────────────

function toGenericRow(r: TimelineLaneRow): GenericLaneRow {
  return {
    lane: r.lane,
    kind: r.kind,
    role: r.role,
    order: r.order,
    height: r.height,
  };
}
