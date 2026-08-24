import type { TimelineClip, TimelineLane } from "../../timeline/model/timeline-types";

type ClipGroupPlacement = {
  clipId: string;
  startTime: number;
  laneId: string;
  duration: number;
};

export type ClipGroupMoveResolve =
  | { valid: true; groupDelta: number; placements: ClipGroupPlacement[] }
  | {
      valid: false;
      reason: "empty_selection" | "missing_clip" | "duplicate_clip" | "collision";
      message: string;
      groupDelta: number;
      placements: ClipGroupPlacement[];
    };

export type ClipGroupMovePlan = {
  clipIds: readonly string[];
  clipById: ReadonlyMap<string, TimelineClip>;
  origins: readonly ClipGroupPlacement[];
  minStart: number;
  resolve: (deltaTime: number) => ClipGroupMoveResolve;
};

type Interval = { start: number; end: number };

function overlaps(intervals: readonly Interval[], start: number, end: number) {
  return intervals.some((interval) => interval.start < end && start < interval.end);
}

/** Pure, reusable move plan used by the existing V1 pointer gesture. */
export function createClipGroupMovePlan(
  doc: Pick<{ clips: TimelineClip[]; lanes: TimelineLane[] }, "clips" | "lanes">,
  clipIds: string[],
): ClipGroupMovePlan {
  const fail = (
    reason: "empty_selection" | "missing_clip" | "duplicate_clip" | "collision",
    message: string,
  ): ClipGroupMovePlan => ({
    clipIds,
    clipById: new Map(),
    origins: [],
    minStart: 0,
    resolve: () => ({ valid: false, reason, message, groupDelta: 0, placements: [] }),
  });
  if (clipIds.length === 0) return fail("empty_selection", "No clips selected.");
  if (new Set(clipIds).size !== clipIds.length) {
    return fail("duplicate_clip", "Duplicate clip selection.");
  }
  const clipById = new Map(doc.clips.map((clip) => [clip.id, clip]));
  if (clipIds.some((id) => !clipById.has(id))) {
    return fail("missing_clip", "Clip not found.");
  }
  const origins = clipIds.map((id) => {
    const clip = clipById.get(id)!;
    return {
      clipId: id,
      startTime: clip.startTime,
      laneId: clip.laneId,
      duration: clip.duration,
    };
  });
  const minStart = Math.min(...origins.map((origin) => origin.startTime));
  const selected = new Set(clipIds);
  const occupied = new Map<string, Interval[]>();
  for (const clip of doc.clips) {
    if (selected.has(clip.id)) continue;
    const list = occupied.get(clip.laneId) ?? [];
    list.push({ start: clip.startTime, end: clip.startTime + clip.duration });
    occupied.set(clip.laneId, list);
  }
  return {
    clipIds,
    clipById,
    origins,
    minStart,
    resolve(deltaTime) {
      const groupDelta = Math.max(deltaTime, -minStart);
      const placements = origins.map((origin) => ({
        ...origin,
        startTime: origin.startTime + groupDelta,
      }));
      const collision = placements.some((placement) =>
        overlaps(
          occupied.get(placement.laneId) ?? [],
          placement.startTime,
          placement.startTime + placement.duration,
        ),
      );
      return collision
        ? {
            valid: false,
            reason: "collision",
            message: "Move would overlap another clip.",
            groupDelta,
            placements,
          }
        : { valid: true, groupDelta, placements };
    },
  };
}
