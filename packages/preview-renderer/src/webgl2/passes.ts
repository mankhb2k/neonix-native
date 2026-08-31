import type { GL } from "./resources";

export type BlendMode =
  | "normal" | "darken" | "multiply" | "color-burn" | "lighten" | "screen"
  | "color-dodge" | "overlay" | "soft-light" | "hard-light" | "difference"
  | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

export function blend(gl: GL, mode: BlendMode): void {
  gl.enable(gl.BLEND);
  if (mode === "multiply") gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === "screen") gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function blendPremultiplied(gl: GL): void {
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}
