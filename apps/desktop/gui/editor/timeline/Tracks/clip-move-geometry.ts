/**
 * Pure clip-move drag resolution — ghost preview and commit share one result.
 */

import {
  clipAcceptsTrack,
  type TimelineClip,
  type TimelineTrackKind,
} from "@motionvideo/editor-core";

export type ClipMovePreviewMember = {
  clipId: string;
  laneId: string;
  startTime: number;
  duration: number;
};

export type ClipMovePreview = {
  clipId: string;
  originLaneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  valid: boolean;
  /** CapCut insert between lanes (new overlay/audio lane). */
  isInsert?: boolean;
  insertOrder?: number | null;
  /** Content Y center for insert chrome (scroll canvas). */
  contentTop?: number;
  label?: string;
  /** Pointer for fixed teal cursor bar (web GlobalDragPreview). */
  clientX?: number;
  clientY?: number;
  /** CapCut vertical snap guide time (clip edge alignment). */
  snapGuideTime?: number | null;
  /** Secondary selected clips (time-shift on home lanes). */
  members?: ClipMovePreviewMember[];
};

export type ClipMoveDropTarget = {
  laneId: string;
  track: TimelineTrackKind;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  contentTop?: number;
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
  insertNewLane?: boolean;
  insertOrder?: number | null;
};

export type ClipMoveDragResult = {
  preview: ClipMovePreview;
  commit: ClipMoveDragCommit;
};

export { clipAcceptsTrack };

/** Start + end edges of other clips (+ t=0) for CapCut live snap. */
export function collectClipEdgeSnapPoints(
  clips: readonly Pick<TimelineClip, "id" | "startTime" | "duration">[],
  excludeIds: ReadonlySet<string>,
): number[] {
  const points: number[] = [0];
  for (const clip of clips) {
    if (excludeIds.has(clip.id)) continue;
    points.push(clip.startTime, clip.startTime + clip.duration);
  }
  return points;
}

/**
 * Snap moving clip start/end to nearest edge.
 * Returns guide time = absolute edge where the CapCut teal line should draw.
 */
export function snapMoveStartToEdges(
  rawStart: number,
  duration: number,
  snapPoints: readonly number[],
  thresholdSec: number,
): { startTime: number; snapGuideTime: number | null } {
  if (!snapPoints.length || thresholdSec < 0) {
    return { startTime: Math.max(0, rawStart), snapGuideTime: null };
  }
  const rawEnd = rawStart + duration;
  let bestStart = rawStart;
  let bestDiff = Infinity;
  let guideTime: number | null = null;

  for (const snap of snapPoints) {
    const dStart = Math.abs(snap - rawStart);
    if (dStart <= thresholdSec && dStart < bestDiff) {
      bestDiff = dStart;
      bestStart = Math.max(0, snap);
      guideTime = snap;
    }
    const endAlignedStart = snap - duration;
    if (endAlignedStart < 0) continue;
    const dEnd = Math.abs(snap - rawEnd);
    if (dEnd <= thresholdSec && dEnd < bestDiff) {
      bestDiff = dEnd;
      bestStart = endAlignedStart;
      guideTime = snap;
    }
  }

  return {
    startTime: bestStart,
    snapGuideTime: guideTime,
  };
}

export function resolveClipMoveDrag(
  input: ClipMoveDragInput,
): ClipMoveDragResult {
  const pps = Math.max(1e-6, input.pixelsPerSecond);
  const rawStart = Math.max(
    0,
    input.pointerContentX / pps - input.grabOffsetSec,
  );
  let startTime = rawStart;
  let snapGuideTime: number | null = null;
  if (input.snapPoints?.length) {
    const snapped = snapMoveStartToEdges(
      rawStart,
      input.duration,
      input.snapPoints,
      input.snapThresholdSec ?? 0.08,
    );
    startTime = snapped.startTime;
    snapGuideTime = snapped.snapGuideTime;
  }

  let previewLaneId = input.originLaneId;
  let commitLaneId = input.originLaneId;
  let commitTrack = input.originTrack;
  let valid = false;
  let insertNewLane = false;
  let insertOrder: number | null = null;

  if (input.drop) {
    previewLaneId = input.drop.laneId;
    insertNewLane = Boolean(input.drop.insertNewLane);
    insertOrder = input.drop.insertOrder ?? null;
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
    isInsert: insertNewLane,
    insertOrder,
    contentTop: input.drop?.contentTop,
    snapGuideTime,
  };

  return {
    preview,
    commit: {
      startTime,
      laneId: commitLaneId,
      track: commitTrack,
      valid,
      moved: true,
      insertNewLane,
      insertOrder,
    },
  };
}
