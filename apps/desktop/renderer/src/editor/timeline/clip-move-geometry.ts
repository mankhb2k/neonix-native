/**
 * Pure clip-move drag resolution — ghost preview and commit share one result.
 */

import {
  clipAcceptsTrack,
  getSnappingPolicy,
  type TimelineClip,
  type TimelineTrackKind,
} from "@motionvideo/editor-core";

export type ClipMovePreview = {
  clipId: string;
  originLaneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  valid: boolean;
};

export type ClipMoveDropTarget = {
  laneId: string;
  track: TimelineTrackKind;
};

export type ClipMoveDragInput = {
  clipId: string;
  clip: Pick<TimelineClip, "kind">;
  originStartTime: number;
  originLaneId: string;
  originTrack: TimelineTrackKind;
  /** Seconds from clip start to grab point (content-space). */
  grabOffsetSec: number;
  pointerContentX: number;
  pixelsPerSecond: number;
  duration: number;
  /** null when pointer is outside the timeline drop zone. */
  drop: ClipMoveDropTarget | null;
  /** Optional live snap points (playhead, clip edges). */
  snapPoints?: number[];
  snapThresholdSec?: number;
};

export type ClipMoveDragCommit = {
  startTime: number;
  laneId: string;
  track: TimelineTrackKind;
  valid: boolean;
  moved: boolean;
};

export type ClipMoveDragResult = {
  preview: ClipMovePreview;
  commit: ClipMoveDragCommit;
};

export { clipAcceptsTrack };

export function resolveClipMoveDrag(
  input: ClipMoveDragInput,
): ClipMoveDragResult {
  const pps = Math.max(1e-6, input.pixelsPerSecond);
  let startTime = Math.max(
    0,
    input.pointerContentX / pps - input.grabOffsetSec,
  );
  if (input.snapPoints?.length) {
    const snapped = getSnappingPolicy().findNearestSnapTime(
      startTime,
      input.snapPoints,
      input.snapThresholdSec ?? 0.08,
    );
    startTime = Math.max(0, snapped.time);
  }

  let previewLaneId = input.originLaneId;
  let commitLaneId = input.originLaneId;
  let commitTrack = input.originTrack;
  let valid = false;

  if (input.drop) {
    previewLaneId = input.drop.laneId;
    if (clipAcceptsTrack(input.clip, input.drop.track)) {
      commitLaneId = input.drop.laneId;
      commitTrack = input.drop.track;
      valid = true;
    } else {
      valid = false;
    }
  }

  const preview: ClipMovePreview = {
    clipId: input.clipId,
    originLaneId: input.originLaneId,
    laneId: previewLaneId,
    startTime,
    duration: input.duration,
    valid,
  };

  return {
    preview,
    commit: {
      startTime,
      laneId: commitLaneId,
      track: commitTrack,
      valid,
      moved: true,
    },
  };
}
