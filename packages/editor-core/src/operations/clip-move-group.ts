/**
 * Atomic multi-clip move — one transaction, group excluded from collision set,
 * shared time delta clamp (preserves relative spacing).
 */

import { selectionClips } from "../selection/editor-selection";
import type { TimelineDocument } from "../document/document";
import { validateTimelineDocument } from "../document/document";
import { rebuildMainProject } from "../timeline/internal/timeline-project-sync";
import {
  isAudioLane,
  isBaseLane,
  isLaneLocked,
  isOverlayLane,
  pruneEmptyLanes,
  type TimelineClip,
  type TimelineLane,
  type TimelineTrackKind,
} from "../timeline/timeline-clips";
import type {
  ClipMovePatch,
  CommandResult,
  TimelineDomainEvent,
} from "../timeline/commands/command-types";
import { selectionHasLockedLane } from "./lane-flags";

export type ClipGroupMove = {
  clipId: string;
  patch: ClipMovePatch;
};

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

function familyOk(
  clip: TimelineClip,
  track: TimelineTrackKind,
  lanes: TimelineLane[],
  existingLaneId: string,
): boolean {
  const onAudio = isAudioLane(lanes, existingLaneId);
  if (track === "audio") return onAudio && clip.kind === "audio";
  if (onAudio || clip.kind !== "scene") return false;
  return track === "main" || track === "overlay";
}

/**
 * Apply all moves against a frozen non-group clip set, then one rebuild.
 * Re-clamps to a shared groupDelta from the first move (primary).
 */
export function moveClipGroup(
  doc: TimelineDocument,
  moves: ClipGroupMove[],
): CommandResult {
  if (!moves.length) {
    return {
      status: "rejected",
      reason: "empty_selection",
      message: "Không có clip nào để di chuyển.",
    };
  }

  const { project, lanes } = doc;
  const clips = [...doc.clips];
  const groupIds = new Set(moves.map((m) => m.clipId));

  for (const move of moves) {
    if (!clips.some((c) => c.id === move.clipId)) {
      return {
        status: "rejected",
        reason: "missing_clip",
        message: "Clip không tồn tại.",
      };
    }
  }

  if (selectionHasLockedLane(clips, lanes, groupIds)) {
    return {
      status: "rejected",
      reason: "locked",
      message: "Lane bị khóa.",
    };
  }

  const primary = moves[0]!;
  const primaryClip = clips.find((c) => c.id === primary.clipId)!;
  const rawDelta = primary.patch.startTime - primaryClip.startTime;
  let minStart = Infinity;
  for (const id of groupIds) {
    const c = clips.find((x) => x.id === id)!;
    minStart = Math.min(minStart, c.startTime);
  }
  const groupDelta = Math.max(rawDelta, -minStart);

  type Planned = {
    existing: TimelineClip;
    startTime: number;
    laneId: string;
    track: TimelineTrackKind;
    fromLaneId: string;
  };

  const planned: Planned[] = [];
  for (const move of moves) {
    const existing = clips.find((c) => c.id === move.clipId)!;
    const startTime = existing.startTime + groupDelta;
    const keepLane = move.patch.track == null;
    const track: TimelineTrackKind = keepLane
      ? trackKindForLane(lanes, existing.laneId)
      : move.patch.track!;
    const laneId = keepLane
      ? existing.laneId
      : (move.patch.laneId ?? existing.laneId);

    if (!familyOk(existing, track, lanes, existing.laneId)) {
      return {
        status: "rejected",
        reason: "collision",
        message: "Clip không tương thích với lane đích.",
      };
    }

    // Group move: time-shift on explicit lane; cross-lane only when caller
    // sets track+laneId (single-clip uses move-clip). Multi-select keeps home.
    const targetLaneId = keepLane ? existing.laneId : laneId;
    if (!lanes.some((l) => l.id === targetLaneId)) {
      return {
        status: "rejected",
        reason: "missing_lane",
        message: "Lane đích không tồn tại.",
      };
    }
    if (isLaneLocked(lanes, targetLaneId)) {
      return {
        status: "rejected",
        reason: "locked",
        message: "Lane bị khóa.",
      };
    }
    if (
      !keepLane &&
      trackKindForLane(lanes, targetLaneId) !== track &&
      !(track === "main" && isBaseLane(lanes, targetLaneId)) &&
      !(track === "overlay" && isOverlayLane(lanes, targetLaneId))
    ) {
      return {
        status: "rejected",
        reason: "collision",
        message: "Track/lane không khớp.",
      };
    }

    planned.push({
      existing,
      startTime,
      laneId: targetLaneId,
      track,
      fromLaneId: existing.laneId,
    });
  }

  const frozenOthers = clips.filter((c) => !groupIds.has(c.id));
  for (const p of planned) {
    if (laneBlocked(frozenOthers, p.laneId, p.startTime, p.existing.duration)) {
      return {
        status: "rejected",
        reason: "collision",
        message: "Va chạm với clip ngoài nhóm.",
      };
    }
  }

  // Intra-group: relative spacing preserved via shared delta — skip mutual checks.

  const movedById = new Map<string, TimelineClip>();
  const events: TimelineDomainEvent[] = [];
  for (const p of planned) {
    let moved: TimelineClip;
    if (p.existing.kind === "audio") {
      moved = {
        ...p.existing,
        kind: "audio",
        laneId: p.laneId,
        startTime: p.startTime,
      };
    } else {
      moved = {
        ...p.existing,
        kind: "scene",
        sceneId: p.existing.sceneId,
        laneId: p.laneId,
        startTime: p.startTime,
      };
    }
    movedById.set(moved.id, moved);
    events.push({
      type: "clip-moved",
      clipId: moved.id,
      fromLaneId: p.fromLaneId,
      toLaneId: moved.laneId,
    });
  }

  let nextClips = clips.map((c) => movedById.get(c.id) ?? c);
  let nextLanes = pruneEmptyLanes(lanes, nextClips);
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
