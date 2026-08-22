import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type AspectRatio = "16:9" | "1:1" | "9:16";

/** Small V2 composition adapters for stage sizing and transport. */
export function compositionAspectRatio(project: MotionProtocolV2): AspectRatio {
  const { width, height } = project.composition;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}

export function compositionFps(project: MotionProtocolV2): number {
  return project.composition.fps;
}

export function compositionSize(project: MotionProtocolV2): {
  width: number;
  height: number;
} {
  return {
    width: project.composition.width,
    height: project.composition.height,
  };
}
