"use client";

import { useMemo } from "react";
import { buildLaneHeightPrefix } from "@/lib/editor/timeline/lane-height-prefix";
import {
  buildLayerLaneRows,
  buildTrackLaneRows,
  timelineVerticalInsets,
  visibleTrackLaneRows,
} from "@/lib/editor/timeline/lane-rows";
import {
  LANE_GAP_PX,
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_START_GUTTER_PX,
} from "@/lib/editor/timeline/web-timeline-scale";
import {
  computeViewportLayout,
  resolvePlayheadScrubMax,
  sliderValueToZoomScale,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core/timeline";

type TimelineDesignMode = "track" | "layer";

type UseTimelineViewportLayoutArgs = {
  mode: TimelineDesignMode;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  viewWidth: number;
  tracksViewportHeight: number;
  zoom: number;
  timelineFitAnchorSeconds: number | null;
  duration: number;
};

export function useTimelineViewportLayout({
  mode,
  clips,
  lanes,
  viewWidth,
  tracksViewportHeight,
  zoom,
  timelineFitAnchorSeconds,
  duration,
}: UseTimelineViewportLayoutArgs) {
  const layout = useMemo(
    () =>
      computeViewportLayout({
        clips,
        trackViewWidth: Math.max(1, viewWidth - TIMELINE_START_GUTTER_PX),
        timelineZoomScale: sliderValueToZoomScale(zoom),
        timelineFitAnchorSeconds,
      }),
    [clips, timelineFitAnchorSeconds, viewWidth, zoom],
  );

  const pps = layout.pixelsPerSecond;
  const rows = useMemo(() => {
    const built =
      mode === "layer"
        ? buildLayerLaneRows(lanes, clips)
        : buildTrackLaneRows(lanes, clips);
    return mode === "layer" ? built : visibleTrackLaneRows(built, clips);
  }, [clips, lanes, mode]);

  const verticalInsets = useMemo(
    () => timelineVerticalInsets(rows, tracksViewportHeight),
    [rows, tracksViewportHeight],
  );
  const scrollContentHeight =
    TIMELINE_RULER_HEIGHT_PX + verticalInsets.contentHeight;

  const laneLayout = useMemo(() => {
    const contentHeights = rows.map((row) => row.height);
    const heightsWithGap = rows.map(
      (row, index) =>
        row.height + (index < rows.length - 1 ? LANE_GAP_PX : 0),
    );
    const clipsByLaneMap = new Map<string, TimelineClip[]>();
    for (const clip of clips) {
      const list = clipsByLaneMap.get(clip.laneId);
      if (list) list.push(clip);
      else clipsByLaneMap.set(clip.laneId, [clip]);
    }
    for (const list of clipsByLaneMap.values()) {
      list.sort((left, right) => left.startTime - right.startTime);
    }
    return {
      laneContentHeights: contentHeights,
      laneHeightPrefix: buildLaneHeightPrefix(heightsWithGap),
      sortedLanes: rows,
      clipsByLaneMap,
    };
  }, [clips, rows]);

  const marqueeTopPadding = TIMELINE_RULER_HEIGHT_PX + verticalInsets.top;
  const trackWidth = layout.canvasWidth;
  const contentWidth = Math.max(
    viewWidth,
    TIMELINE_START_GUTTER_PX + trackWidth,
  );
  const canvasDuration = Math.max(duration, layout.extentSeconds);
  const scrubMax = resolvePlayheadScrubMax(canvasDuration, duration);

  return {
    layout,
    pps,
    rows,
    verticalInsets,
    scrollContentHeight,
    laneContentHeights: laneLayout.laneContentHeights,
    laneHeightPrefix: laneLayout.laneHeightPrefix,
    sortedLanes: laneLayout.sortedLanes,
    clipsByLaneMap: laneLayout.clipsByLaneMap,
    marqueeTopPadding,
    trackWidth,
    contentWidth,
    canvasDuration,
    scrubMax,
  };
}
