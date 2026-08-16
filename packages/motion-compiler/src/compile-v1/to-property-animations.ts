import { V1 } from "@motionvideo/motion-protocol";
import type { MotionRuntimePropertyAnimation } from "@motionvideo/motion-protocol/runtime";

/** Compile authoring `timeline.clips` into runtime `propertyAnimations`. */
export function timelineClipsToPropertyAnimations(
  clips: V1.TimelinePropertyClipV1[] | undefined,
): MotionRuntimePropertyAnimation[] {
  return (clips ?? []).map((clip) => ({
    layerId: clip.layerId,
    property: clip.property,
    keys: clip.keys.map((key) => ({
      t: key.t,
      v: key.value as MotionRuntimePropertyAnimation["keys"][number]["v"],
      ...(key.easing !== undefined ? { easing: key.easing } : {}),
    })),
  }));
}

/** Compile component instance prop keyframes into one runtime propertyAnimation. */
export function componentPropKeyframesToPropertyAnimations(input: {
  instanceId: string;
  internalLayerId: string;
  property: string;
  keys: Array<{ t: number; value: unknown; easing?: unknown }>;
  propKind: string;
}): MotionRuntimePropertyAnimation {
  const valueKind =
    input.propKind === "number"
      ? "number"
      : input.propKind === "color"
        ? "color"
        : input.propKind === "boolean"
          ? "boolean"
          : input.propKind === "asset"
            ? "asset"
            : "string";
  return {
    layerId: `${input.instanceId}__${input.internalLayerId}`,
    property: input.property,
    valueKind,
    keys: input.keys.map((key) => ({
      t: key.t,
      v: key.value as MotionRuntimePropertyAnimation["keys"][number]["v"],
      ...(key.easing !== undefined
        ? {
            easing:
              key.easing as NonNullable<
                MotionRuntimePropertyAnimation["keys"][number]["easing"]
              >,
          }
        : {}),
    })),
  };
}
