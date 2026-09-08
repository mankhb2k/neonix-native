import {
  type TimelineClip,
  type TimelineLane,
  buildLaneRows,
  timelineLanesStackHeightWithGap as timelineLanesStackHeightCore,
  type GenericLaneRow,
  type LaneRowConfig,
} from "@motionvideo/editor-core/timeline";
import {
  BASE_LANE_HEIGHT_PX,
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
  LANE_GAP_PX,
  SECONDARY_LANE_HEIGHT_PX,
  TIMELINE_BOTTOM_PADDING_PX,
  TIMELINE_TOP_PADDING_PX,
  VIDEO_LANE_HEIGHT_PX,
} from "./web-timeline-scale";

export const webLaneRowConfig: LaneRowConfig = {
  baseHeight: BASE_LANE_HEIGHT_PX,
  secondaryHeight: SECONDARY_LANE_HEIGHT_PX,
  layerHeight: LAYER_LANE_HEIGHT_PX,
  layerVideoHeight: LAYER_VIDEO_LANE_HEIGHT_PX,
  gapPx: LANE_GAP_PX,
  topPaddingPx: TIMELINE_TOP_PADDING_PX,
  bottomPaddingPx: TIMELINE_BOTTOM_PADDING_PX,
};

export type LaneRow = TimelineLane & { height: number };

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

export function buildTrackLaneRows(
  lanes: TimelineLane[],
  clips: readonly TimelineClip[] = [],
): LaneRow[] {
  const rows = buildLaneRows(lanes, webLaneRowConfig);
  return rows.map((row) => {
    const laneClips = clips.filter((clip) => clip.laneId === row.lane.id);
    const hasVideo = laneClips.some(
      (clip) => clip.kind === "scene" && clip.mediaType === "video",
    );
    const hasImage = laneClips.some(
      (clip) => clip.kind === "scene" && clip.mediaType === "image",
    );
    const mediaHeight = hasVideo
      ? VIDEO_LANE_HEIGHT_PX
      : hasImage
        ? BASE_LANE_HEIGHT_PX
        : SECONDARY_LANE_HEIGHT_PX;
    return {
      ...row.lane,
      height: row.kind === "audio" ? SECONDARY_LANE_HEIGHT_PX : mediaHeight,
      kind: row.kind,
      role: row.role,
      order: row.order,
    } as LaneRow;
  });
}

export function buildLayerLaneRows(
  lanes: TimelineLane[],
  clips: readonly TimelineClip[] = [],
): LaneRow[] {
  return [...lanes]
    .sort((left, right) => left.order - right.order)
    .map((lane, index) => {
      const hasVideo = clips.some(
        (clip) =>
          clip.laneId === lane.id &&
          clip.kind === "scene" &&
          clip.mediaType === "video",
      );
      return {
        ...lane,
        height: hasVideo
          ? VIDEO_LANE_HEIGHT_PX
          : index === 0
            ? LAYER_VIDEO_LANE_HEIGHT_PX
            : LAYER_LANE_HEIGHT_PX,
      };
    });
}

export function timelineVerticalInsets(
  rows: readonly LaneRow[],
  viewHeight: number,
): { top: number; bottom: number; contentHeight: number } {
  const genericRows: GenericLaneRow[] = rows.map((row) => ({
    lane: row,
    kind: row.kind,
    role: row.role,
    order: row.order,
    height: row.height,
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
  const baseIndex = rows.findIndex(
    (row) => row.kind === "visual" && row.role === "base",
  );
  const axis =
    baseIndex >= 0
      ? baseIndex
      : rows.findLastIndex((row) => row.kind === "visual");
  let above = 0;
  for (let index = 0; index < Math.max(axis, 0); index += 1) {
    above += rows[index].height + webLaneRowConfig.gapPx;
  }
  const axisHeight = rows[Math.max(axis, 0)]?.height ?? 0;
  const maxTop = Math.max(minTop, contentHeight - stack - minBottom);
  const centeredTop = Math.round(contentHeight / 2 - above - axisHeight / 2);
  const top = Math.min(Math.max(minTop, centeredTop), maxTop);
  return { top, bottom: contentHeight - stack - top, contentHeight };
}

export {
  timelineLanesContentHeight,
  laneContentOffsetTop,
  laneHeightsWithGaps,
} from "@motionvideo/editor-core/timeline";
