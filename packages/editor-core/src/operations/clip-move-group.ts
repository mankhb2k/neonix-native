/**
 * Atomic multi-clip move — one transaction, group excluded from collision set,
 * shared time delta clamp (preserves relative spacing).
 *
 * Command seam: `{ type: "move-clips"; clipIds; deltaTime }` (B3).
 */

import { selectionClips } from "../selection/editor-selection";
import type { TimelineDocument } from "../document/document";
import { validateTimelineDocument } from "../document/document";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
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

export function trackKindForLane(
  lanes: TimelineLane[],
  laneId: string,
): TimelineTrackKind {
  if (isAudioLane(lanes, laneId)) return "audio";
  if (isBaseLane(lanes, laneId)) return "main";
  return "overlay";
}

function rangesOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  const aEnd = aStart + aDur;
  const bEnd = bStart + bDur;
  return aStart < bEnd - 1e-9 && bStart < aEnd - 1e-9;
}

function laneBlocked(
  others: TimelineClip[],
  laneId: string,
  startTime: number,
  duration: number,
): boolean {
  return others.some(
    (c) =>
      c.laneId === laneId &&
      rangesOverlap(c.startTime, c.duration, startTime, duration),
  );
}

export type ClipGroupPlacement = {
  clipId: string;
  startTime: number;
  laneId: string;
  duration: number;
  track: TimelineTrackKind;
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

/**
 * Pure resolve for preview + commit — time-only keep-lane group shift.
 */
export function resolveClipGroupMove(
  doc: Pick<TimelineDocument, "clips" | "lanes">,
  clipIds: string[],
  deltaTime: number,
): ClipGroupMoveResolve {
  const empty: ClipGroupMoveResolve = {
    valid: false,
    reason: "empty_selection",
    message: "Không có clip nào để di chuyển.",
    groupDelta: 0,
    placements: [],
  };
  if (!clipIds.length) return empty;

  const dup = new Set<string>();
  for (const id of clipIds) {
    if (dup.has(id)) {
      return {
        valid: false,
        reason: "duplicate_clip",
        message: "Danh sách clip bị trùng.",
        groupDelta: 0,
        placements: [],
      };
    }
    dup.add(id);
  }

  const { lanes } = doc;
  const clips = doc.clips;
  const groupIds = new Set(clipIds);

  for (const id of clipIds) {
    if (!clips.some((c) => c.id === id)) {
      return {
        valid: false,
        reason: "missing_clip",
        message: "Clip không tồn tại.",
        groupDelta: 0,
        placements: [],
      };
    }
  }

  if (selectionHasLockedLane(clips, lanes, groupIds)) {
    return {
      valid: false,
      reason: "locked",
      message: "Lane bị khóa.",
      groupDelta: 0,
      placements: [],
    };
  }

  let minStart = Infinity;
  for (const id of clipIds) {
    const c = clips.find((x) => x.id === id)!;
    minStart = Math.min(minStart, c.startTime);
  }
  const groupDelta = Math.max(deltaTime, -minStart);

  const placements: ClipGroupPlacement[] = [];
  for (const id of clipIds) {
    const existing = clips.find((c) => c.id === id)!;
    if (isLaneLocked(lanes, existing.laneId)) {
      return {
        valid: false,
        reason: "locked",
        message: "Lane bị khóa.",
        groupDelta,
        placements,
      };
    }
    placements.push({
      clipId: id,
      startTime: existing.startTime + groupDelta,
      laneId: existing.laneId,
      duration: existing.duration,
      track: trackKindForLane(lanes, existing.laneId),
    });
  }

  const frozenOthers = clips.filter((c) => !groupIds.has(c.id));
  for (const p of placements) {
    if (laneBlocked(frozenOthers, p.laneId, p.startTime, p.duration)) {
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
  let nextProject = rebuildMainProject(project, nextClips, nextLanes);
  nextProject = {
    ...nextProject,
    timeline: {
      ...nextProject.timeline,
      audioTracks: nextProject.timeline.audioTracks.map((t) => {
        const moved = movedById.get(t.id);
        return moved && moved.kind === "audio"
          ? { ...t, start: moved.startTime }
          : t;
      }),
    },
  };

  const document: TimelineDocument = {
    project: nextProject,
    lanes: nextLanes,
    clips: nextClips,
    ...(doc.transitions?.length ? { transitions: doc.transitions } : {}),
  };
  const validation = validateTimelineDocument(document);
  if (!validation.valid) {
    return {
      status: "rejected",
      reason: "invalid_document",
      message: `Document vi phạm invariants: ${validation.violations.map((v) => v.message).join("; ")}`,
    };
  }

  return {
    status: "applied",
    document,
    selection: selectionClips([...groupIds]),
    events,
  };
}
