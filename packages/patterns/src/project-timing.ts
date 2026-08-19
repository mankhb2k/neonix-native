/**
 * Project timing helpers — frame-grid canonicalization + derived duration.
 */
import { V1 } from "@motionvideo/motion-protocol";

type LayerV1 = V1.LayerV1;
type MotionProjectV1 = V1.MotionProjectV1;
const snapLayerTreeToFrameGrid = V1.snapLayerTreeToFrameGrid;

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

export function roundProjectDurationValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function getRootLayerEndV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  let end = 0;
  for (const layer of layers) {
    if (layer.parentLayerId !== null) continue;
    end = Math.max(end, layer.timing.start + layer.timing.duration);
  }
  return roundProjectDurationValue(end);
}

export function deriveProjectDurationV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): number {
  return getRootLayerEndV1(layers);
}

export function hasRootLayersV1(
  layers: ReadonlyArray<Pick<LayerV1, "parentLayerId" | "timing">>,
): boolean {
  return layers.some((layer) => layer.parentLayerId === null);
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
