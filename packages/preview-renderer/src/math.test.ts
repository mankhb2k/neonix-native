import { describe, expect, it } from "vitest";
import { gradientUniforms, MAX_GRADIENT_STOPS } from "./math";

describe("gradient GPU uniforms", () => {
  it("packs all multi-stop colors and offsets in stable order", () => {
    const uniforms = gradientUniforms({
      type: "linear-gradient",
      angle: 90,
      stops: [
        { offset: 0, color: "#ff0000" },
        { offset: 0.25, color: "#00ff00" },
        { offset: 1, color: "#0000ff" },
      ],
    }, 1);
    expect(uniforms.meta[0]).toBe(3);
    expect(Array.from(uniforms.offsets.slice(0, 3))).toEqual([0, 0.25, 1]);
    expect(Array.from(uniforms.stops.slice(0, 12))).toEqual([
      1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1,
    ]);
  });

  it("packs conic origin and start angle without throwing", () => {
    const uniforms = gradientUniforms({
      type: "conic-gradient",
      from: 45,
      cx: 0.25,
      cy: 0.75,
      stops: [{ offset: 0, color: "#fff" }, { offset: 1, color: "#000000" }],
    }, 0.5);
    expect(uniforms.params[0]).toBe(3);
    expect(uniforms.params[2]).toBe(0.25);
    expect(uniforms.params[3]).toBe(0.75);
    expect(uniforms.meta[0]).toBe(2);
  });

  it("uses a LUT fallback instead of losing stops beyond the uniform budget", () => {
    const stops = Array.from({ length: MAX_GRADIENT_STOPS + 2 }, (_, index) => ({ offset: index / (MAX_GRADIENT_STOPS + 1), color: "#ffffff" }));
    const uniforms = gradientUniforms({ type: "linear-gradient", stops }, 1);
    expect(uniforms.meta[0]).toBe(0);
    expect(uniforms.lut).toHaveLength(256 * 4);
  });
});
