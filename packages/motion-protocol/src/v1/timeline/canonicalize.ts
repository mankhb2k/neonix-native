/**
 * Canonical hóa duration timeline V1 + snap frame-grid.
 *
 * Điền `timeline.duration` còn thiếu từ điểm kết thúc nội dung cuối, rồi snap
 * mọi field timing lên `composition.fps` để IR canonical không còn giá trị
 * lệch lưới (ví dụ `1.001` ở `1fps`).
 */
import type { MotionProjectV1 } from "../project";
import { deriveTimelineDurationV1 } from "./duration";
import { snapSecondsToFrameGrid, snapTimelineToFrameGrid } from "./frame-grid";

export interface CanonicalizeTimelineDurationIssue {
  path: string;
  message: string;
  severity: "info" | "warn";
}

export interface CanonicalizeTimelineDurationResult {
  project: MotionProjectV1;
  issues: CanonicalizeTimelineDurationIssue[];
}

/**
 * Trả về project luôn có `timeline.duration` và timing nằm trên frame-grid.
 *
 * Thứ tự:
 * 1. Snap timing đã authoring lên `composition.fps`.
 * 2. `duration = max(declared đã snap | 0, derive(content đã snap))` rồi snap.
 *    Đảm bảo sau snap không còn clip end > timeline.duration.
 *
 * Không mutate object đầu vào.
 */
export function canonicalizeTimelineDurationV1(
  project: MotionProjectV1,
): CanonicalizeTimelineDurationResult {
  // Deep clone để không đụng object của caller.
  const cloned: MotionProjectV1 = JSON.parse(JSON.stringify(project));
  const issues: CanonicalizeTimelineDurationIssue[] = [];
  const fps = Math.max(1, cloned.composition.fps);

  const beforeSnap = JSON.stringify(cloned.timeline);
  const hadDuration = cloned.timeline.duration !== undefined;
  cloned.timeline = snapTimelineToFrameGrid(cloned.timeline, fps);
  if (JSON.stringify(cloned.timeline) !== beforeSnap) {
    issues.push({
      path: "timeline",
      message: `Snapped timeline timing fields onto ${fps}fps frame grid`,
      severity: "info",
    });
  }

  const derived = deriveTimelineDurationV1(cloned.timeline);
  const declared = cloned.timeline.duration;
  const raised = Math.max(declared ?? 0, derived);
  const snappedDuration = snapSecondsToFrameGrid(raised, fps);

  if (!hadDuration || declared === undefined) {
    cloned.timeline.duration = snappedDuration;
    issues.push({
      path: "timeline.duration",
      message: `Derived timeline.duration = ${snappedDuration} from timeline content`,
      severity: "info",
    });
  } else if (snappedDuration > declared + 1e-12) {
    cloned.timeline.duration = snappedDuration;
    issues.push({
      path: "timeline.duration",
      message: `Raised timeline.duration from ${declared} to ${snappedDuration} after frame-grid snap so content fits`,
      severity: "info",
    });
  } else {
    cloned.timeline.duration = snapSecondsToFrameGrid(declared, fps);
  }

  return { project: cloned, issues };
}
