import type {
  AspectRatio,
  MotionProjectV3,
} from "@motionvideo/motion-protocol";

/**
 * Phase 3: v3 projects carry width/height on `composition` (metadata lost
 * `aspectRatio`). Map back to the render pipeline's `AspectRatio` union.
 */
export function compositionAspectRatio(project: MotionProjectV3): AspectRatio {
  const { width, height } = project.composition;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}
