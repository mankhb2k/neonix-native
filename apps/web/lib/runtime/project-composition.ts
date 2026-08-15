import type { AspectRatio, MotionProject } from "@motionvideo/motion-protocol";

/**
 * Phase 3: v1 projects carry width/height/fps on `composition` (metadata lost
 * `aspectRatio`/`fps`). Small adapters for UI + stage sizing.
 */
export function compositionAspectRatio(project: MotionProject): AspectRatio {
  const { width, height } = project.composition;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}

export function compositionFps(project: MotionProject): number {
  return project.composition.fps;
}

export function compositionSize(project: MotionProject): {
  width: number;
  height: number;
} {
  return {
    width: project.composition.width,
    height: project.composition.height,
  };
}
