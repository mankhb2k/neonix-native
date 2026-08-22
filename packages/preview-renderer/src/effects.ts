import type { RuntimeColorAdjustEffectOp } from "@motionvideo/motion-runtime";

/** Four color-adjust operators fit one inline pixel-local effect pass. */
export const COLOR_ADJUST_UNIFORM_FLOATS = 20;

export function colorAdjustUniforms(
  adjustments: readonly RuntimeColorAdjustEffectOp[] | undefined,
): Float32Array {
  const uniforms = new Float32Array(COLOR_ADJUST_UNIFORM_FLOATS);
  const count = Math.min(adjustments?.length ?? 0, 4);
  uniforms[0] = count;
  for (let index = 0; index < count; index += 1) {
    const effect = adjustments![index]!;
    const offset = 4 + index * 4;
    uniforms.set(
      [effect.brightness, effect.contrast, effect.saturation, effect.hueRotate * Math.PI / 180],
      offset,
    );
  }
  return uniforms;
}
