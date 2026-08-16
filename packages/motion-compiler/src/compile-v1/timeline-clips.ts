import { V1 } from "@motionvideo/motion-protocol";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";

type RuntimePropertyAnimation = MotionRuntimeProject["propertyAnimations"][number];

/** Compile authoring timeline.clips into runtime propertyAnimations. */
export function timelineClipsToPropertyAnimations(
  clips: V1.TimelinePropertyClipV1[] | undefined,
): RuntimePropertyAnimation[] {
  return (clips ?? []).map((clip) => ({
    layerId: clip.layerId,
    property: clip.property,
    keys: clip.keys.map((key) => ({
      t: key.t,
      v: key.value as RuntimePropertyAnimation["keys"][number]["v"],
      ...(key.easing !== undefined ? { easing: key.easing } : {}),
    })),
  }));
}
