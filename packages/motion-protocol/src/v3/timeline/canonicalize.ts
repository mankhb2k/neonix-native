/**
 * Canonical hóa duration timeline V3 + snap frame-grid.
 *
 * Điền `timeline.duration` còn thiếu từ điểm kết thúc nội dung cuối, rồi snap
 * mọi field timing lên `composition.fps` để IR canonical không còn giá trị
 * lệch lưới (ví dụ `1.001` ở `1fps`).
 */
import type { MotionProjectV3 } from "../project";
import { deriveTimelineDurationV3 } from "./duration";
import { snapTimelineToFrameGrid } from "./frame-grid";

export interface CanonicalizeTimelineDurationIssue {
  path: string;
  message: string;
  severity: "info" | "warn";
}

export interface CanonicalizeTimelineDurationResult {
  project: MotionProjectV3;
  issues: CanonicalizeTimelineDurationIssue[];
}

/**
 * Trả về project luôn có `timeline.duration` và timing nằm trên frame-grid.
 *
 * Thứ tự:
 * 1. Snap timing đã authoring lên `composition.fps`.
 * 2. Derive `timeline.duration` còn thiếu từ điểm kết thúc nội dung đã snap.
 * 3. Snap duration (kể cả vừa derive) lên cùng lưới.
 *
 * Không mutate object đầu vào.
 */
export function canonicalizeTimelineDurationV3(
  project: MotionProjectV3,
): CanonicalizeTimelineDurationResult {
  // Deep clone để không đụng object của caller.
  const cloned: MotionProjectV3 = JSON.parse(JSON.stringify(project));
  const issues: CanonicalizeTimelineDurationIssue[] = [];
  const fps = Math.max(1, cloned.composition.fps);

  const beforeSnap = JSON.stringify(cloned.timeline);
  // Snap nội dung trước để duration derive tính từ đầu/cuối đã on-grid.
  const hadDuration = cloned.timeline.duration !== undefined;
  cloned.timeline = snapTimelineToFrameGrid(cloned.timeline, fps);
  if (JSON.stringify(cloned.timeline) !== beforeSnap) {
    issues.push({
      path: "timeline",
      message: `Snapped timeline timing fields onto ${fps}fps frame grid`,
      severity: "info",
    });
  }

  if (!hadDuration || cloned.timeline.duration === undefined) {
    const derived = deriveTimelineDurationV3(cloned.timeline);
    const snappedDerived = snapTimelineToFrameGrid(
      { duration: derived },
      fps,
    ).duration!;
    cloned.timeline.duration = snappedDerived;
    issues.push({
      path: "timeline.duration",
      message: `Derived timeline.duration = ${snappedDerived} from timeline content`,
      severity: "info",
    });
  }

  return { project: cloned, issues };
}
