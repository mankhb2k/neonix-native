import type { AspectRatio } from "@motionvideo/motion-protocol";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

/** Map Protocol V2 composition dimensions to the encoder aspect union. */
export function compositionAspectRatio(
  project: MotionProtocolV2,
): AspectRatio {
  const ratio = project.composition.width / project.composition.height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}
