/**
 * Validate tính toàn vẹn timeline V3.
 *
 * Helper thuần (không gắn Zod) để bắt lỗi cấu trúc: trùng clip id, overlap
 * main-track, v.v. Schema project `superRefine` gọi
 * `collectTimelineIntegrityIssues` rồi chuyển từng issue thành Zod issue để
 * từ chối input authoring sớm.
 */
import type { ProjectTimelineV3 } from "./schema";

export interface TimelineIntegrityIssue {
  /** Path lỗi tương đối timeline (không có segment `timeline` đứng đầu). */
  path: (string | number)[];
  message: string;
}

const EPSILON = 1e-9;

function transitionBridgeDuration(
  transition: { type: string; duration?: number } | undefined,
): number {
  if (!transition || transition.type === "cut") return 0;
  return Math.max(0, transition.duration ?? 0);
}

/**
 * Thu thập lỗi cấu trúc của timeline:
 *
 * - Trùng visual clip id (unique trên cả timeline, không chỉ trong một track).
 * - Overlap main-track: clip `main` không được chồng nhau trừ khi có transition
 *   khác `cut` cầu nối **và** độ dài overlap ≤ duration transition cầu nối.
 *   Overlay được phép chồng tự do.
 *
 * Trùng `order` giữa các track được CHO PHÉP cố ý — compiler sort ổn định theo
 * `order`, tie-break theo thứ tự mảng gốc.
 */
export function collectTimelineIntegrityIssues(
  timeline: ProjectTimelineV3,
): TimelineIntegrityIssue[] {
  const issues: TimelineIntegrityIssue[] = [];

  // Trùng visual clip id.
  const seenClipIds = new Set<string>();
  for (const track of timeline.visualTracks) {
    for (const clip of track.clips) {
      if (seenClipIds.has(clip.id)) {
        issues.push({
          path: ["visualTracks", track.id, "clips", clip.id],
          message: `Duplicate visual clip id: "${clip.id}"`,
        });
      }
      seenClipIds.add(clip.id);
    }
  }

  // Chính sách overlap main-track.
  for (const track of timeline.visualTracks) {
    if (track.role !== "main") continue;
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const prevEnd = prev.start + prev.duration;
      if (cur.start >= prevEnd - EPSILON) continue;

      const overlap = prevEnd - cur.start;
      const outDur = transitionBridgeDuration(prev.transitionOut);
      const inDur = transitionBridgeDuration(cur.transitionIn);
      // Crossfade / dual bridge: một phía cover overlap là đủ → lấy max
      // duration của hai transition khác cut.
      const bridgeDuration = Math.max(outDur, inDur);

      if (bridgeDuration <= EPSILON) {
        issues.push({
          path: ["visualTracks", track.id, "clips", cur.id],
          message: `Main-track clip "${cur.id}" overlaps "${prev.id}" without a transition`,
        });
        continue;
      }

      if (overlap > bridgeDuration + EPSILON) {
        issues.push({
          path: ["visualTracks", track.id, "clips", cur.id],
          message: `Main-track clip "${cur.id}" overlaps "${prev.id}" by ${overlap}s which exceeds transition duration ${bridgeDuration}s`,
        });
      }
    }
  }

  return issues;
}
