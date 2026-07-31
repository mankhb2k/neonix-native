import type { TimelineClip, TimelineLane } from "./model/timeline-types";
import type { TimelineDocument } from "../document/document";

/**
 * Derived index builders per TimelineDocument reference.
 * Pure memoizable selectors for query performance.
 */

export function lanesById(doc: TimelineDocument): Map<string, TimelineLane> {
  const map = new Map<string, TimelineLane>();
  for (const lane of doc.lanes) {
    map.set(lane.id, lane);
  }
  return map;
}

export function clipsById(doc: TimelineDocument): Map<string, TimelineClip> {
  const map = new Map<string, TimelineClip>();
  for (const clip of doc.clips) {
    map.set(clip.id, clip);
  }
  return map;
}

export function clipsByLane(doc: TimelineDocument): Map<string, TimelineClip[]> {
  const map = new Map<string, TimelineClip[]>();
  for (const lane of doc.lanes) {
    map.set(lane.id, []);
  }
  for (const clip of doc.clips) {
    if (!clip.laneId) continue;
    const list = map.get(clip.laneId);
    if (list) {
      list.push(clip);
    } else {
      map.set(clip.laneId, [clip]);
    }
  }
  // Sắp xếp clip theo startTime tăng dần
  for (const list of map.values()) {
    list.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  }
  return map;
}

export function contentEndSeconds(doc: TimelineDocument): number {
  return doc.clips.reduce(
    (end, clip) =>
      Math.max(end, Math.max(0, clip.startTime) + Math.max(0, clip.duration)),
    0,
  );
}

export type VisualLayerIndexItem = {
  lane: TimelineLane;
  clips: TimelineClip[];
};

/**
 * Build Visual composition sequence index for rendering/preview.
 * Base lane first (order -1), followed by Overlay lanes ordered by `order` ascending.
 */
export function visualCompositionIndex(
  doc: TimelineDocument,
): VisualLayerIndexItem[] {
  const byLaneMap = clipsByLane(doc);
  const visualLanes = doc.lanes
    .filter((lane) => lane.kind === "visual")
    .sort((a, b) => a.order - b.order);

  return visualLanes.map((lane) => ({
    lane,
    clips: byLaneMap.get(lane.id) ?? [],
  }));
}
