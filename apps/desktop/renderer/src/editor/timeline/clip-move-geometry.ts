/**
 * Pure clip-move drag resolution — ghost preview and commit share one result.
 */

import type { TimelineClip, TimelineTrackKind } from "@motionvideo/editor-core";

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

export function clipAcceptsTrack(
  clip: Pick<TimelineClip, "kind">,
  track: TimelineTrackKind,
): boolean {
  if (clip.kind === "audio") return track === "audio";
  return track === "main" || track === "overlay";
}

export function resolveClipMoveDrag(
  input: ClipMoveDragInput,
): ClipMoveDragResult {
  const pps = Math.max(1e-6, input.pixelsPerSecond);
  const startTime = Math.max(
    0,
    input.pointerContentX / pps - input.grabOffsetSec,
  );

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
