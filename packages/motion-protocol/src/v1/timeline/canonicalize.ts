/**
 * Điền timeline.duration còn thiếu rồi snap mọi timing lên lưới composition.fps.
 */
import type { MotionProjectV1 } from "../project";
import { deriveTimelineDurationV1 } from "./duration";
import {
  snapSecondsToFrameGrid,
  snapLayerTreeToFrameGrid,
  snapTimelineToFrameGrid,
} from "./frame-grid";

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
 * 1. Snap layer + timeline timing đã authoring lên `composition.fps`.
 * 2. `duration = max(declared đã snap | 0, derive(root layers đã snap))` rồi snap.
 *
 * Không mutate object đầu vào.
 */
export function canonicalizeTimelineDurationV1(
  project: MotionProjectV1,
): CanonicalizeTimelineDurationResult {
  const cloned: MotionProjectV1 = JSON.parse(JSON.stringify(project));
  const issues: CanonicalizeTimelineDurationIssue[] = [];
  const fps = Math.max(1, cloned.composition.fps);

  const beforeSnap = JSON.stringify({
    timeline: cloned.timeline,
    layers: cloned.layers,
  });
  const hadDuration = cloned.timeline.duration !== undefined;
  cloned.layers = snapLayerTreeToFrameGrid(cloned.layers, fps);
  cloned.timeline = snapTimelineToFrameGrid(cloned.timeline, fps);
  if (
    JSON.stringify({ timeline: cloned.timeline, layers: cloned.layers }) !==
    beforeSnap
  ) {
    issues.push({
      path: "timeline",
      message: `Snapped timeline timing fields onto ${fps}fps frame grid`,
      severity: "info",
    });
  }

  const derived = deriveTimelineDurationV1(cloned.layers);
  const declared = cloned.timeline.duration;
  const raised = Math.max(declared ?? 0, derived);
  const snappedDuration = snapSecondsToFrameGrid(raised, fps);

  if (!hadDuration || declared === undefined) {
    cloned.timeline.duration = snappedDuration;
    issues.push({
      path: "timeline.duration",
      message: `Derived timeline.duration = ${snappedDuration} from root layer timing`,
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
