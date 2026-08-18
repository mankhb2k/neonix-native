import type { TimelineClip, TimelineLane } from "./model/timeline-types";
import type { TimelineDocument } from "../document/document";

/**
 * Bộ dựng index dẫn xuất theo từng TimelineDocument.
 * Selector thuần túy có thể memo để tăng tốc truy vấn.
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

export function clipsByLane(
  doc: TimelineDocument,
): Map<string, TimelineClip[]> {
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

export type LaneClipIndexItem = {
  lane: TimelineLane;
  clips: TimelineClip[];
};

/** @deprecated Dùng LaneClipIndexItem thay thế (item là lane + clips). */
export type VisualLayerIndexItem = LaneClipIndexItem;

/**
 * Dựng index chuỗi composition visual cho render/preview.
 * Base lane trước (order -1), rồi Overlay lane sắp theo `order` tăng dần.
 */
export function visualCompositionIndex(
  doc: TimelineDocument,
): LaneClipIndexItem[] {
  const byLaneMap = clipsByLane(doc);
  const visualLanes = doc.lanes
    .filter((lane) => lane.kind === "visual")
    .sort((a, b) => a.order - b.order);

  return visualLanes.map((lane) => ({
    lane,
    clips: byLaneMap.get(lane.id) ?? [],
  }));
}
