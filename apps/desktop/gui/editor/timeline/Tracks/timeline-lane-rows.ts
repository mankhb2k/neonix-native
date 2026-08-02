import type { TimelineLane } from "@motionvideo/editor-core";
import {
  BASE_LANE_HEIGHT_PX,
  SECONDARY_LANE_HEIGHT_PX,
} from "../timeline-scale";

export { BASE_LANE_HEIGHT_PX, SECONDARY_LANE_HEIGHT_PX };
export const LANE_GAP_PX = 2;
export const TIMELINE_TOP_PADDING_PX = 40;
export const TIMELINE_BOTTOM_PADDING_PX = 40;

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

/** Web order: overlays (desc) → main/base → audios (asc). */
export function buildTimelineLaneRows(
  timelineLanes: ReadonlyArray<TimelineLane>,
): TimelineLaneRow[] {
  const baseLane = timelineLanes.find(
    (l) => l.kind === "visual" && l.role === "base",
  );
  const overlayLanes = timelineLanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .sort((a, b) => b.order - a.order);
  const audioLanes = timelineLanes
    .filter((l) => l.kind === "audio")
    .sort((a, b) => a.order - b.order);

  const rows: TimelineLaneRow[] = [];

  for (const lane of overlayLanes) {
    rows.push({
      id: lane.id,
      kind: "visual",
      role: "overlay",
      order: lane.order,
      name: lane.name,
      height: SECONDARY_LANE_HEIGHT_PX,
      heightClass: "h-12",
      lane,
    });
  }

  if (baseLane) {
    rows.push({
      id: baseLane.id,
      kind: "visual",
      role: "base",
      order: baseLane.order,
      name: baseLane.name,
      height: BASE_LANE_HEIGHT_PX,
      heightClass: "h-15",
      lane: baseLane,
    });
  }

  for (const lane of audioLanes) {
    rows.push({
      id: lane.id,
      kind: "audio",
      role: "audio",
      order: lane.order,
      name: lane.name,
      height: SECONDARY_LANE_HEIGHT_PX,
      heightClass: "h-12",
      lane,
    });
  }

  return rows;
}

/** Content height including top/bottom padding and gaps between rows. */
export function timelineLanesContentHeight(rows: readonly TimelineLaneRow[]): number {
  if (rows.length === 0) {
    return TIMELINE_TOP_PADDING_PX + TIMELINE_BOTTOM_PADDING_PX;
  }
  let sum = TIMELINE_TOP_PADDING_PX + TIMELINE_BOTTOM_PADDING_PX;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i]!.height;
    if (i < rows.length - 1) sum += LANE_GAP_PX;
  }
  return sum;
}

/** Lane stack height without outer padding. */
export function timelineLanesStackHeight(rows: readonly TimelineLaneRow[]): number {
  if (rows.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i]!.height;
    if (i < rows.length - 1) sum += LANE_GAP_PX;
  }
  return sum;
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
  const stack = timelineLanesStackHeight(rows);
  const minContent =
    stack + TIMELINE_TOP_PADDING_PX + TIMELINE_BOTTOM_PADDING_PX;
  const contentHeight = Math.max(minContent, Math.max(0, viewHeight), 1);
  const leftover = Math.max(0, contentHeight - stack);
  const top = Math.max(TIMELINE_TOP_PADDING_PX, Math.floor(leftover / 2));
  const bottom = Math.max(TIMELINE_BOTTOM_PADDING_PX, leftover - top);
  return { top, bottom, contentHeight };
}

/** Y offset of lane index within content (after top padding). */
export function laneContentOffsetTop(
  rows: readonly TimelineLaneRow[],
  laneIndex: number,
): number {
  let top = TIMELINE_TOP_PADDING_PX;
  for (let i = 0; i < laneIndex; i += 1) {
    top += rows[i]!.height + LANE_GAP_PX;
  }
  return top;
}

/** Heights array for virtualization (padding as fake spacers not included — caller adds padding). */
export function laneHeightsWithGaps(rows: readonly TimelineLaneRow[]): number[] {
  const heights: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    heights.push(rows[i]!.height);
    if (i < rows.length - 1) heights.push(LANE_GAP_PX);
  }
  return heights;
}
