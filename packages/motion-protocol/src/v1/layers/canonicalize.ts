/**
 * Snap layer timing lên lưới composition.fps.
 * Duration không ghi vào authoring JSON — trả về derived max root end.
 */
import type { MotionProjectV1 } from "../types";
import { deriveProjectDurationV1 } from "./project-duration";
import { snapLayerTreeToFrameGrid } from "./frame-grid";

export interface CanonicalizeProjectTimingIssue {
  path: string;
  message: string;
  severity: "info" | "warn";
}

export interface CanonicalizeProjectTimingResult {
  project: MotionProjectV1;
  duration: number;
  issues: CanonicalizeProjectTimingIssue[];
}

/**
 * Trả về project đã snap layer timing lên frame-grid, và duration derived.
 *
 * Không mutate object đầu vào. Không ghi duration vào project.
 */
export function canonicalizeProjectTimingV1(
  project: MotionProjectV1,
): CanonicalizeProjectTimingResult {
  const cloned: MotionProjectV1 = JSON.parse(JSON.stringify(project));
  const issues: CanonicalizeProjectTimingIssue[] = [];
  const fps = Math.max(1, cloned.composition.fps);

  const beforeSnap = JSON.stringify(cloned.layers);
  cloned.layers = snapLayerTreeToFrameGrid(cloned.layers, fps);
  if (JSON.stringify(cloned.layers) !== beforeSnap) {
    issues.push({
      path: "layers",
      message: `Snapped layer timing fields onto ${fps}fps frame grid`,
      severity: "info",
    });
  }

  const duration = deriveProjectDurationV1(cloned.layers);
  return { project: cloned, duration, issues };
}
