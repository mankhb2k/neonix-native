import { V1 } from "@motionvideo/motion-protocol";
import type { MotionRuntimePropertyAnimation } from "@motionvideo/motion-protocol/runtime";

/** Compile authoring `layer.animations[]` into runtime `propertyAnimations`. */
export function layerAnimationsToPropertyAnimations(
  layers: readonly V1.LayerV1[] | undefined,
): MotionRuntimePropertyAnimation[] {
  const out: MotionRuntimePropertyAnimation[] = [];
  const walk = (nodes: readonly V1.LayerV1[]): void => {
    for (const layer of nodes) {
      for (const animation of V1.getLayerAnimations(layer)) {
        out.push({
          layerId: layer.id,
          property: animation.property,
          keys: animation.keys.map((key) => ({
            t: key.t,
            v: key.value as MotionRuntimePropertyAnimation["keys"][number]["v"],
            ...(key.easing !== undefined ? { easing: key.easing } : {}),
          })),
        });
      }
      if (layer.type === "group") walk(layer.children);
    }
  };
  walk(layers ?? []);
  return out;
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
