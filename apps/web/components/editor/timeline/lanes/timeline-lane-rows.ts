import type {
  TimelineClip,
  TimelineLane,
} from "@motionvideo/editor-core/timeline-runtime";
import {
  buildLaneRows,
  timelineLanesStackHeightWithGap as timelineLanesStackHeightCore,
  type GenericLaneRow,
  type LaneRowConfig,
} from "@motionvideo/editor-core/timeline-runtime";
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

/**
 * Occupied visual rows only — empty Main is not a droppable lane below overlays.
 * Keep the empty base row when nothing is on the timeline (dashed Main hint).
 */
export function visibleTrackLaneRows(
  rows: readonly LaneRow[],
  clips: readonly { laneId: string }[],
): LaneRow[] {
  const used = new Set(clips.map((clip) => clip.laneId));
  const occupiedVisual = rows.some(
    (row) => row.kind === "visual" && used.has(row.id),
  );
  if (!occupiedVisual) return [...rows];
  return rows.filter((row) => row.kind === "audio" || used.has(row.id));
}

/** CapCut order: overlays (desc) → base → audios (asc). */
export function buildTrackLaneRows(
  lanes: TimelineLane[],
  clips: readonly TimelineClip[] = [],
): LaneRow[] {
  const rows = buildLaneRows(lanes, webLaneRowConfig);
  return rows.map((r) => {
    const clip = clips.find((candidate) => candidate.laneId === r.lane.id);
    const mediaHeight =
      clip?.kind === "scene" &&
      (clip.mediaType === "image" || clip.mediaType === "video")
        ? BASE_LANE_HEIGHT_PX
        : SECONDARY_LANE_HEIGHT_PX;
    return {
      ...r.lane,
      height: r.kind === "audio" ? SECONDARY_LANE_HEIGHT_PX : mediaHeight,
      kind: r.kind,
      role: r.role,
      order: r.order,
    } as LaneRow;
  });
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

function axisLaneIndex(rows: readonly LaneRow[]): number {
  const base = rows.findIndex(
    (row) => row.kind === "visual" && row.role === "base",
  );
  if (base >= 0) return base;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]!.kind === "visual") return i;
  }
  return 0;
}

/**
 * CapCut axis: keep Main (zIndex 0) on the vertical midpoint.
 * Overlay insert space is the empty canvas above; audio is the empty canvas below.
 * Padding is not a lane — only occupied rows use `--timeline-track-lane`.
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
  const stack = timelineLanesStackHeightCore(genericRows, webLaneRowConfig);
  const minTop = webLaneRowConfig.topPaddingPx;
  const minBottom = webLaneRowConfig.bottomPaddingPx;
  const contentHeight = Math.max(
    stack + minTop + minBottom,
    Math.max(0, viewHeight),
    1,
  );
  if (rows.length === 0) {
    return { top: minTop, bottom: contentHeight - minTop, contentHeight };
  }
  const axis = axisLaneIndex(rows);
  let above = 0;
  for (let i = 0; i < axis; i += 1) {
    above += rows[i]!.height + webLaneRowConfig.gapPx;
  }
  const axisHeight = rows[axis]?.height ?? 0;
  const maxTop = Math.max(minTop, contentHeight - stack - minBottom);
  const centeredTop = Math.round(contentHeight / 2 - above - axisHeight / 2);
  const top = Math.min(Math.max(minTop, centeredTop), maxTop);
  const bottom = contentHeight - stack - top;
  return { top, bottom, contentHeight };
}

// Re-export core helpers for convenience
export {
  timelineLanesContentHeight,
  laneContentOffsetTop,
  laneHeightsWithGaps,
} from "@motionvideo/editor-core/timeline-runtime";
