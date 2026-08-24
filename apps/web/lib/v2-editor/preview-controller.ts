import {
  compileProtocolV2,
} from "@motionvideo/motion-compiler";
import {
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
  type RuntimeFrameV2,
} from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

/**
 * Small, backend-neutral V2 preview controller.
 *
 * The editor uses this for deterministic frame/time math. Rendering remains
 * owned by PreviewStage and @motionvideo/preview-renderer.
 */
export function previewFrameAtTime(
  project: MotionProtocolV2,
  time: number,
): RuntimeFrameV2 {
  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  const runtime = compileProtocolV2(project);
  const frame = frameIndexAtTime(safeTime, project.composition.fps);
  return evaluateRuntimeProjectV2(runtime, frame, { time: safeTime });
}

export function projectDuration(project: MotionProtocolV2): number {
  return project.layers.reduce(
    (end, layer) => Math.max(end, layer.timing.start + layer.timing.duration),
    0,
  );
}

export function frameCount(project: MotionProtocolV2): number {
  return Math.max(1, Math.ceil(projectDuration(project) * project.composition.fps));
}
