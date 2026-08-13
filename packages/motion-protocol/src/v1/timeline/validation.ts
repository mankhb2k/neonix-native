/**
 * Validate tính toàn vẹn timeline V1.
 *
 * - Trùng visual clip id / audio clip id.
 * - Track `order` unique trên toàn timeline (visual + audio).
 * - Visual lane exclusive: cùng track không overlap thời gian (không exception).
 * - Audio: overlap trong cùng track được phép (mix); không suy luận crossfade.
 */
import type { ProjectTimelineV1 } from "./schema";

export interface TimelineIntegrityIssue {
  /** Path lỗi tương đối timeline (không có segment `timeline` đứng đầu). */
  path: (string | number)[];
  message: string;
}

const EPSILON = 1e-9;

type TrackOrderOwner = { kind: "visual" | "audio"; id: string };

/**
 * Thu thập lỗi cấu trúc của timeline.
 */
export function collectTimelineIntegrityIssues(
  timeline: ProjectTimelineV1,
): TimelineIntegrityIssue[] {
  const issues: TimelineIntegrityIssue[] = [];

  // Unique order across visual + audio tracks (sparse keys; not contiguous).
  const seenOrders = new Map<number, TrackOrderOwner>();
  for (const track of timeline.visualTracks) {
    const existing = seenOrders.get(track.order);
    if (existing !== undefined) {
      issues.push({
        path: ["visualTracks", track.id, "order"],
        message: `Duplicate track order ${track.order}: ${existing.kind} track "${existing.id}" and visual track "${track.id}"`,
      });
    } else {
      seenOrders.set(track.order, { kind: "visual", id: track.id });
    }
  }
  for (const track of timeline.audioTracks) {
    const existing = seenOrders.get(track.order);
    if (existing !== undefined) {
      issues.push({
        path: ["audioTracks", track.id, "order"],
        message: `Duplicate track order ${track.order}: ${existing.kind} track "${existing.id}" and audio track "${track.id}"`,
      });
    } else {
      seenOrders.set(track.order, { kind: "audio", id: track.id });
    }
  }

  // Trùng visual clip id.
  const seenVisualClipIds = new Set<string>();
  for (const track of timeline.visualTracks) {
    for (const clip of track.clips) {
      if (seenVisualClipIds.has(clip.id)) {
        issues.push({
          path: ["visualTracks", track.id, "clips", clip.id],
          message: `Duplicate visual clip id: "${clip.id}"`,
        });
      }
      seenVisualClipIds.add(clip.id);
    }
  }

  // Lane exclusive trên mọi visual track (không transition bridge).
  for (const track of timeline.visualTracks) {
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const prevEnd = prev.start + prev.duration;
      if (cur.start >= prevEnd - EPSILON) continue;

      issues.push({
        path: ["visualTracks", track.id, "clips", cur.id],
        message: `Track "${track.id}" clip "${cur.id}" overlaps "${prev.id}" — same-lane clips cannot overlap; place concurrent scenes on a different track order`,
      });
    }
  }

  // Unique audio clip ids across timeline.
  const seenAudioClipIds = new Set<string>();
  for (const track of timeline.audioTracks) {
    for (const clip of track.clips) {
      if (seenAudioClipIds.has(clip.id)) {
        issues.push({
          path: ["audioTracks", track.id, "clips", clip.id],
          message: `Duplicate audio clip id: "${clip.id}"`,
        });
      }
      seenAudioClipIds.add(clip.id);
    }
  }

  return issues;
}
