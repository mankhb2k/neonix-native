/**
 * Giải thuật kéo-thả move clip thuần — ghost preview và commit dùng chung một kết quả.
 * Visual occupancy không cho chồng trong cùng lane; audio dùng mixer policy riêng.
 */

import { clipAcceptsLane } from "../../timeline/clip-capabilities";
import {
  resolveExclusiveRowPlacement,
  resolveOccupancyAwarePlacement,
} from "../../timeline/policies/placement-policy";
import { resolveAudioClipPlacement } from "../../timeline/policies/audio-placement-policy";
import type {
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
  VisualMediaType,
} from "../../timeline/model/timeline-types";

export type ClipMovePreviewMember = {
  clipId: string;
  laneId: string;
  startTime: number;
  duration: number;
  trackKind: TimelineTrackKind;
  /** Offset Y tương đối so với vị trí gốc của clip chính. */
  offsetY: number;
  laneHeightPx?: number;
};

export type ClipMovePreview = {
  clipId: string;
  originLaneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  valid: boolean;
  trackKind: TimelineTrackKind;
  mediaType?: VisualMediaType;
  /** CapCut insert giữa các lane (lane overlay/audio mới). */
  isInsert?: boolean;
  insertOrder?: number | null;
  /** Content Y center cho chrome insert (scroll canvas). */
  contentTop?: number;
  label?: string;
  /** Pointer Y để render clip nổi. */
  clientX?: number;
  clientY?: number;
  /** Offset chuột kéo từ đỉnh của clip chính. */
  grabOffsetY?: number;
  /** Chiều cao body lane (px) — float bubble khớp với strip chrome. */
  laneHeightPx?: number;
  /** Guide snap dọc CapCut (căn mép clip). */
  snapGuideTime?: number | null;
  /** Các clip phụ được chọn (time-shift trên lane gốc của nó). */
  members?: ClipMovePreviewMember[];
};

export type ClipMoveDropTarget = {
  laneId: string;
  track: TimelineTrackKind;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  contentTop?: number;
  /** Content Y cho indicator insert khi occupancy chuyển thành insert. */
  laneTopContentY?: number;
  laneOrder?: number;
  laneRole?: "base" | "overlay" | "audio";
};

export type ClipMoveDragInput = {
  clipId: string;
  clip: {
    kind: TimelineClip["kind"];
    mediaType?: VisualMediaType;
  };
  originStartTime: number;
  originLaneId: string;
  originTrack: TimelineTrackKind;
  /** Giây từ đầu clip tới điểm kéo (content-space). */
  grabOffsetSec: number;
  pointerContentX: number;
  pixelsPerSecond: number;
  duration: number;
  /** null khi con trỏ nằm ngoài vùng drop của timeline. */
  drop: ClipMoveDropTarget | null;
  /** Các điểm snap trực tiếp tùy chọn (playhead, mép clip). */
  snapPoints?: number[];
  snapThresholdSec?: number;
  /** Các clip cho occupancy (cùng document); excludeIds bỏ qua các clip đang di chuyển. */
  occupancyClips?: ReadonlyArray<
    Pick<TimelineClip, "id" | "laneId" | "startTime" | "duration">
  >;
  /** Ưu tiên hơn việc filter occupancyClips mỗi frame. */
  clipsByLane?: ReadonlyMap<
    string,
    ReadonlyArray<Pick<TimelineClip, "id" | "startTime" | "duration">>
  >;
  excludeIds?: ReadonlySet<string>;
  /** Danh sách lane để ưu tiên tìm lane trống phía trên khi xung đột. */
  lanes?: ReadonlyArray<Pick<TimelineLane, "id" | "kind" | "role" | "order">>;
  /** Ưu tiên hơn việc remap lanes mỗi frame. */
  siblingLaneRefs?: ReadonlyArray<{
    id: string;
    order: number;
    role: "base" | "overlay" | "audio";
  }>;
  overlayLaneRefs?: ReadonlyArray<{
    id: string;
    order: number;
    role: "base" | "overlay" | "audio";
  }>;
  audioLaneRefs?: ReadonlyArray<{
    id: string;
    order: number;
    role: "base" | "overlay" | "audio";
  }>;
  /** Group surface: một con mỗi hàng — swap occupant, không bao giờ pack. */
  exclusiveRows?: boolean;
};

export type ClipMoveDragCommit = {
  startTime: number;
  laneId: string;
  track: TimelineTrackKind;
  valid: boolean;
  moved: boolean;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  swapClipId?: string | null;
};

export type ClipMoveDragResult = {
  preview: ClipMovePreview;
  commit: ClipMoveDragCommit;
};

export { clipAcceptsLane };

/** Index i đầu tiên thỏa sorted[i] >= x (hoặc length). */
export function lowerBound(sorted: readonly number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Mép start + end của các clip khác (+ t=0), sắp xếp tăng dần và duy nhất. */
export function collectClipEdgeSnapPoints(
  clips: readonly Pick<TimelineClip, "id" | "startTime" | "duration">[],
  excludeIds: ReadonlySet<string>,
): number[] {
  const points: number[] = [0];
  for (const clip of clips) {
    if (excludeIds.has(clip.id)) continue;
    points.push(clip.startTime, clip.startTime + clip.duration);
  }
  points.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const p of points) {
    if (unique.length === 0 || unique[unique.length - 1] !== p) {
      unique.push(p);
    }
  }
  return unique;
}

/**
 * Snap start/end của clip đang di chuyển tới mép gần nhất.
 * Yêu cầu snapPoints đã sort và duy nhất. Chỉ quét các điểm trong cửa sổ threshold.
 * Trả về guide time = mép tuyệt đối nơi vạch teal CapCut nên vẽ.
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

  const considerStartAlign = (snap: number) => {
    const dStart = Math.abs(snap - rawStart);
    if (dStart <= thresholdSec && dStart < bestDiff) {
      bestDiff = dStart;
      bestStart = Math.max(0, snap);
      guideTime = snap;
    }
  };
  const considerEndAlign = (snap: number) => {
    const endAlignedStart = snap - duration;
    if (endAlignedStart < 0) return;
    const dEnd = Math.abs(snap - rawEnd);
    if (dEnd <= thresholdSec && dEnd < bestDiff) {
      bestDiff = dEnd;
      bestStart = endAlignedStart;
      guideTime = snap;
    }
  };

  // Start-align: các điểm gần rawStart
  let i = lowerBound(snapPoints, rawStart - thresholdSec);
  while (i < snapPoints.length) {
    const snap = snapPoints[i]!;
    if (snap > rawStart + thresholdSec) break;
    considerStartAlign(snap);
    i += 1;
  }

  // End-align: các điểm gần rawEnd
  i = lowerBound(snapPoints, rawEnd - thresholdSec);
  while (i < snapPoints.length) {
    const snap = snapPoints[i]!;
    if (snap > rawEnd + thresholdSec) break;
    considerEndAlign(snap);
    i += 1;
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
  let swapClipId: string | null = null;
  let contentTop = input.drop?.contentTop;

  if (input.drop) {
    previewLaneId = input.drop.laneId;
    insertNewLane = Boolean(input.drop.insertNewLane);
    insertOrder = input.drop.insertOrder ?? null;
    if (
      clipAcceptsLane(input.clip, {
        kind: input.drop.track === "audio" ? "audio" : "visual",
      })
    ) {
      commitLaneId = input.drop.laneId;
      commitTrack = input.drop.track;
      valid = true;
    } else {
      valid = false;
    }

    // Audio is a mixer domain: clips in one track are allowed to overlap.
    // Visual layers keep the occupancy policy below.
    if (valid && commitTrack === "audio" && !insertNewLane) {
      const audioPlacement = resolveAudioClipPlacement(startTime);
      startTime = audioPlacement.startTime;
      insertNewLane = audioPlacement.insertNewLane;
      insertOrder = audioPlacement.insertOrder;
      snapGuideTime = audioPlacement.edgeGuideTime;
    } else if (valid && !insertNewLane && input.drop.laneId) {
      const laneId = input.drop.laneId;
      const onLane =
        input.clipsByLane?.get(laneId) ??
        (input.occupancyClips ?? []).filter((c) => c.laneId === laneId);
      // Ưu tiên meta drop tường minh; ngược lại resolve từ lanes (integration không
      // được ngầm coi base/audio là overlay order 0).
      const laneMeta = (input.lanes ?? []).find((l) => l.id === laneId);
      const role =
        input.drop.laneRole ??
        (laneMeta?.kind === "audio"
          ? "audio"
          : laneMeta?.role === "base"
            ? "base"
            : "overlay");
      const laneOrder = input.drop.laneOrder ?? laneMeta?.order ?? 0;
      const siblingLanes =
        input.siblingLaneRefs ??
        (input.lanes ?? []).map((l) => ({
          id: l.id,
          order: l.order,
          role:
            l.kind === "audio"
              ? ("audio" as const)
              : l.role === "base"
                ? ("base" as const)
                : ("overlay" as const),
        }));
      const occupancy = input.exclusiveRows
        ? resolveExclusiveRowPlacement({
            clipsOnLane: onLane,
            desiredStart: startTime,
            excludeIds: input.excludeIds,
          })
        : resolveOccupancyAwarePlacement({
            clipsOnLane: onLane,
            desiredStart: startTime,
            duration: input.duration,
            excludeIds: input.excludeIds,
            laneId,
            laneOrder,
            laneRole: role,
            siblingLanes,
            allClips: input.occupancyClips,
            clipsByLane: input.clipsByLane,
            overlayLaneRefs: input.overlayLaneRefs,
            audioLaneRefs: input.audioLaneRefs,
          });
      startTime = occupancy.startTime;
      if (occupancy.edgeGuideTime != null) {
        snapGuideTime = occupancy.edgeGuideTime;
      }
      if (occupancy.swapClipId) {
        swapClipId = occupancy.swapClipId;
      } else if (occupancy.retargetLaneId) {
        previewLaneId = occupancy.retargetLaneId;
        commitLaneId = occupancy.retargetLaneId;
        const rRole = occupancy.retargetLaneRole ?? "overlay";
        commitTrack =
          rRole === "audio" ? "audio" : rRole === "base" ? "main" : "overlay";
      } else if (occupancy.insertNewLane) {
        insertNewLane = true;
        insertOrder = occupancy.insertOrder ?? null;
        commitTrack =
          commitTrack === "audio"
            ? "audio"
            : role === "base" || commitTrack === "main"
              ? "overlay"
              : commitTrack;
        if (input.drop.laneTopContentY != null) {
          contentTop = input.drop.laneTopContentY;
        }
      }
    }
  }

  const preview: ClipMovePreview = {
    clipId: input.clipId,
    originLaneId: input.originLaneId,
    laneId: previewLaneId,
    startTime,
    duration: input.duration,
    valid,
    trackKind: commitTrack,
    mediaType: input.clip.kind === "scene" ? input.clip.mediaType : undefined,
    isInsert: insertNewLane,
    insertOrder,
    contentTop,
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
      swapClipId,
    },
  };
}
