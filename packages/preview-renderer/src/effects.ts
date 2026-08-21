import type { RuntimeEffect } from "@motionvideo/motion-runtime";

/** Four color-adjust operators fit one inline pixel-local effect pass. */
export const COLOR_ADJUST_UNIFORM_FLOATS = 20;

export function colorAdjustUniforms(
  effects: RuntimeEffect[] | undefined,
): Float32Array {
  const uniforms = new Float32Array(COLOR_ADJUST_UNIFORM_FLOATS);
  const colorAdjustments = (effects ?? []).filter(
    (effect): effect is Extract<RuntimeEffect, { type: "color-adjust" }> =>
      effect.type === "color-adjust",
  );
  const count = Math.min(colorAdjustments.length, 4);
  uniforms[0] = count;
  for (let index = 0; index < count; index += 1) {
    const effect = colorAdjustments[index]!;
    const offset = 4 + index * 4;
    uniforms.set(
      [effect.brightness, effect.contrast, effect.saturation, effect.hueRotate * Math.PI / 180],
      offset,
    );
  }
  return uniforms;
}
