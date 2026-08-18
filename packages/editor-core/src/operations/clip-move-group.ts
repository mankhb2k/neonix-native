/**
 * Atomic multi-clip move — one transaction, group excluded from collision set,
 * shared time delta clamp (preserves relative spacing).
 *
 * Command seam: `{ type: "move-clips"; clipIds; deltaTime }` (B3).
 * UI-0.1: `createClipGroupMovePlan` reuses indexes across pointer frames.
 */

import { selectionClips } from "../selection/editor-selection";
import type { TimelineDocument } from "../document/document";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
import { finishSuccess } from "../timeline/commands/runner-state";
import {
  isAudioLane,
  isBaseLane,
  isLaneLocked,
  pruneEmptyLanes,
  type TimelineClip,
  type TimelineLane,
  type TimelineTrackKind,
} from "../timeline/timeline-clips";
import type {
  CommandResult,
  TimelineDomainEvent,
} from "../timeline/commands/command-types";
import { selectionHasLockedLane } from "./lane-flags";

/**
 * UI/compat term cho lane → `TimelineTrackKind` ("main" | "overlay" | "audio").
 * Không phải protocol term: lane role canonical là `base | overlay | audio`.
 * Chỉ dùng để gắn track cho `move-clip` patch (UI-facing); group move không cần.
 */
export function uiTrackKindForLane(
  lanes: TimelineLane[],
  laneId: string,
): TimelineTrackKind {
  if (isAudioLane(lanes, laneId)) return "audio";
  if (isBaseLane(lanes, laneId)) return "main";
  return "overlay";
}

type LaneInterval = { startTime: number; duration: number; endTime: number };

type LaneIntervalIndex = {
  /** Sorted by startTime ascending. */
  intervals: LaneInterval[];
  /** maxEndPrefix[i] = max endTime among intervals[0..i]. */
  maxEndPrefix: number[];
};

function buildLaneIntervalIndex(raw: LaneInterval[]): LaneIntervalIndex {
  const intervals = [...raw].sort((a, b) => a.startTime - b.startTime);
  const maxEndPrefix: number[] = [];
  let maxEnd = -Infinity;
  for (let i = 0; i < intervals.length; i += 1) {
    maxEnd = Math.max(maxEnd, intervals[i]!.endTime);
    maxEndPrefix.push(maxEnd);
  }
  return { intervals, maxEndPrefix };
}

/**
 * O(log N): intervals with startTime < queryEnd that also extend past queryStart.
 * Uses sorted starts + prefix max end.
 */
function laneBlockedIntervals(
  index: LaneIntervalIndex | undefined,
  startTime: number,
  duration: number,
): boolean {
  if (!index?.intervals.length) return false;
  const queryEnd = startTime + duration;
  const { intervals, maxEndPrefix } = index;
  // First index with startTime >= queryEnd → candidates are [0, lo)
  let lo = 0;
  let hi = intervals.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (intervals[mid]!.startTime < queryEnd) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return false;
  return maxEndPrefix[lo - 1]! > startTime + 1e-9;
}

export type ClipGroupPlacement = {
  clipId: string;
  startTime: number;
  laneId: string;
  duration: number;
};

export type ClipGroupMoveRejectReason =
  | "locked"
  | "collision"
  | "missing_clip"
  | "missing_lane"
  | "empty_selection"
  | "duplicate_clip"
  | "invalid_document";

export type ClipGroupMoveResolve =
  | {
      valid: true;
      groupDelta: number;
      placements: ClipGroupPlacement[];
    }
  | {
      valid: false;
      reason: ClipGroupMoveRejectReason;
      message: string;
      groupDelta: number;
      placements: ClipGroupPlacement[];
    };

export type ClipGroupMovePlan = {
  clipIds: readonly string[];
  clipById: ReadonlyMap<string, TimelineClip>;
  /** Origin placements (startTime before delta). */
  origins: readonly ClipGroupPlacement[];
  minStart: number;
  resolve: (deltaTime: number) => ClipGroupMoveResolve;
};

type PlanBuildFail = {
  ok: false;
  resolve: ClipGroupMoveResolve;
};

type PlanBuildOk = {
  ok: true;
  plan: ClipGroupMovePlan;
};

function buildClipGroupMovePlan(
  doc: Pick<TimelineDocument, "clips" | "lanes">,
  clipIds: string[],
): PlanBuildFail | PlanBuildOk {
  const empty: ClipGroupMoveResolve = {
    valid: false,
    reason: "empty_selection",
    message: "Không có clip nào để di chuyển.",
    groupDelta: 0,
    placements: [],
  };
  if (!clipIds.length) {
    return { ok: false, resolve: empty };
  }

  const dup = new Set<string>();
  for (const id of clipIds) {
    if (dup.has(id)) {
      return {
        ok: false,
        resolve: {
          valid: false,
          reason: "duplicate_clip",
          message: "Danh sách clip bị trùng.",
          groupDelta: 0,
          placements: [],
        },
      };
    }
    dup.add(id);
  }

  const { lanes } = doc;
  const clips = doc.clips;
  const clipById = new Map(clips.map((c) => [c.id, c]));
  const groupIds = new Set(clipIds);

  for (const id of clipIds) {
    if (!clipById.has(id)) {
      return {
        ok: false,
        resolve: {
          valid: false,
          reason: "missing_clip",
          message: "Clip không tồn tại.",
          groupDelta: 0,
          placements: [],
        },
      };
    }
  }

  if (selectionHasLockedLane(clips, lanes, groupIds)) {
    return {
      ok: false,
      resolve: {
        valid: false,
        reason: "locked",
        message: "Lane bị khóa.",
        groupDelta: 0,
        placements: [],
      },
    };
  }

  let minStart = Infinity;
  const origins: ClipGroupPlacement[] = [];
  for (const id of clipIds) {
    const existing = clipById.get(id)!;
    if (isLaneLocked(lanes, existing.laneId)) {
      return {
        ok: false,
        resolve: {
          valid: false,
          reason: "locked",
          message: "Lane bị khóa.",
          groupDelta: 0,
          placements: [],
        },
      };
    }
    minStart = Math.min(minStart, existing.startTime);
    origins.push({
      clipId: id,
      startTime: existing.startTime,
      laneId: existing.laneId,
      duration: existing.duration,
    });
  }

  /** Non-group intervals indexed by lane — sorted + prefix-max end (O(log N) query). */
  const intervalsByLane = new Map<string, LaneIntervalIndex>();
  const rawByLane = new Map<string, LaneInterval[]>();
  for (const c of clips) {
    if (groupIds.has(c.id)) continue;
    const iv: LaneInterval = {
      startTime: c.startTime,
      duration: c.duration,
      endTime: c.startTime + c.duration,
    };
    const list = rawByLane.get(c.laneId);
    if (list) list.push(iv);
    else rawByLane.set(c.laneId, [iv]);
  }
  for (const [laneId, list] of rawByLane) {
    intervalsByLane.set(laneId, buildLaneIntervalIndex(list));
  }

  const plan: ClipGroupMovePlan = {
    clipIds,
    clipById,
    origins,
    minStart,
    resolve(deltaTime: number): ClipGroupMoveResolve {
      const groupDelta = Math.max(deltaTime, -minStart);
      const placements: ClipGroupPlacement[] = origins.map((o) => ({
        ...o,
        startTime: o.startTime + groupDelta,
      }));
      for (const p of placements) {
        if (
          laneBlockedIntervals(
            intervalsByLane.get(p.laneId),
            p.startTime,
            p.duration,
          )
        ) {
          return {
            valid: false,
            reason: "collision",
            message: "Va chạm với clip ngoài nhóm.",
            groupDelta,
            placements,
          };
        }
      }
      return { valid: true, groupDelta, placements };
    },
  };

  return { ok: true, plan };
}

/**
 * Build a reusable plan for pointer-frame resolves (UI-0.1).
 * Invalid selection still returns a plan whose `resolve` always yields the reject.
 */
export function createClipGroupMovePlan(
  doc: Pick<TimelineDocument, "clips" | "lanes">,
  clipIds: string[],
): ClipGroupMovePlan {
  const built = buildClipGroupMovePlan(doc, clipIds);
  if (built.ok) return built.plan;
  const fail = built.resolve;
  return {
    clipIds,
    clipById: new Map(),
    origins: [],
    minStart: 0,
    resolve: () => fail,
  };
}

/**
 * Pure resolve for preview + commit — time-only keep-lane group shift.
 * Thin wrapper over createClipGroupMovePlan (tests keep calling this).
 */
export function resolveClipGroupMove(
  doc: Pick<TimelineDocument, "clips" | "lanes">,
  clipIds: string[],
  deltaTime: number,
): ClipGroupMoveResolve {
  return createClipGroupMovePlan(doc, clipIds).resolve(deltaTime);
}

/**
 * Apply resolved group move → one rebuild / CommandResult.
 */
export function moveClipGroup(
  doc: TimelineDocument,
  clipIds: string[],
  deltaTime: number,
): CommandResult {
  const resolved = resolveClipGroupMove(doc, clipIds, deltaTime);
  if (!resolved.valid) {
    return {
      status: "rejected",
      reason: resolved.reason,
      message: resolved.message,
    };
  }

  const { project, lanes } = doc;
  const clips = [...doc.clips];
  const groupIds = new Set(clipIds);
  const byId = new Map(clips.map((c) => [c.id, c]));

  const movedById = new Map<string, TimelineClip>();
  const events: TimelineDomainEvent[] = [];
  for (const p of resolved.placements) {
    const existing = byId.get(p.clipId)!;
    let moved: TimelineClip;
    if (existing.kind === "audio") {
      moved = {
        ...existing,
        kind: "audio",
        laneId: p.laneId,
        startTime: p.startTime,
      };
    } else {
      moved = {
        ...existing,
        kind: "scene",
        sceneId: existing.sceneId,
        laneId: p.laneId,
        startTime: p.startTime,
      };
    }
    movedById.set(moved.id, moved);
    events.push({
      type: "clip-moved",
      clipId: moved.id,
      fromLaneId: existing.laneId,
      toLaneId: moved.laneId,
    });
  }

  const nextClips = clips.map((c) => movedById.get(c.id) ?? c);
  const nextLanes = pruneEmptyLanes(lanes, nextClips);
  const rebuilt = rebuildMainProject(project, nextClips, nextLanes);

  // Đi qua cùng một ranh giới protocol (MotionProjectV1Schema) + stamp
  // revision/fingerprint như mọi command family khác, thay vì dựng document
  // thủ công bỏ qua gate.
  return finishSuccess(
    rebuilt,
    nextLanes,
    nextClips,
    selectionClips([...groupIds]),
    events,
    doc.transitions,
    doc.revision,
  );
}
