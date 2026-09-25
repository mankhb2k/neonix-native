import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";
import { parseColor, parsePaintLayers } from "../src/compiler/paint";
import { parseFilter } from "../src/compiler/filter";

// Everyday CSS paint that the compiler either rejected outright or accepted
// while silently dropping part of it. Gradient color-stop resolution follows
// Blink's CSSGradientValue::AddStops() (third_party/blink/renderer/core/css/
// css_gradient_value.cc) so the compiled stops match what Chrome paints.

const box = { width: 400, height: 300 };
const viewport = { width: 1920, height: 1080 };

function gradient(value: string, gradientBox: { width: number; height: number } | undefined = box) {
  const [paint] = parsePaintLayers(value, "background", "#000000", gradientBox);
  if (!paint || typeof paint === "string") throw new Error(`expected a gradient for ${value}`);
  return paint;
}

describe("gradient color-stop tokenizing", () => {
  it("keeps rgba()/hsla() with internal spaces as one color token", () => {
    expect(gradient("linear-gradient(90deg, rgba(255, 255, 255, 0) 42%, rgba(255, 255, 255, 0.1) 50%)").stops).toEqual([
      { offset: 0.42, color: "#ffffff00" },
      { offset: 0.5, color: "#ffffff1a" },
    ]);
    expect(gradient("linear-gradient(hsla(0, 100%, 50%, .5), hsl(240 100% 50%))").stops.map((stop) => stop.color)).toEqual(["#ff000080", "#0000ffff"]);
  });

  it("accepts a stop list authored across several lines", () => {
    expect(gradient("linear-gradient(\n  135deg,\n  rgba(34, 211, 238, 0.9) 0%,\n  rgba(168, 85, 247, 0.9) 100%\n)").stops).toHaveLength(2);
  });

  it("treats a 4-digit hex as a color, not as the gradient direction", () => {
    expect(gradient("linear-gradient(#fff8, #0008)").stops.map((stop) => stop.color)).toEqual(["#ffffff88", "#00000088"]);
    expect(parseColor("#F0A8", "color")).toBe("#ff00aa88");
  });
});

describe("gradient color-stop positions", () => {
  it("expands a double-position stop into a hard edge instead of dropping the second position", () => {
    expect(gradient("linear-gradient(90deg, #f00 0% 30%, #00f 30% 100%)").stops).toEqual([
      { offset: 0, color: "#ff0000" },
      { offset: 0.3, color: "#ff0000" },
      { offset: 0.3, color: "#0000ff" },
      { offset: 1, color: "#0000ff" },
    ]);
  });

  it("resolves px and calc() positions against the linear gradient line length", () => {
    // 90deg on a 400x300 box: the gradient line is 400px long.
    expect(gradient("linear-gradient(90deg, #f00 0px, #00f 200px)").stops.map((stop) => stop.offset)).toEqual([0, 0.5]);
    expect(gradient("linear-gradient(90deg, #f00 calc(50% - 100px), #00f)").stops[0]!.offset).toBeCloseTo(0.25, 10);
  });

  it("resolves conic stop positions given as angles", () => {
    expect(gradient("conic-gradient(#f00 0deg 90deg, #00f 90deg 180deg, #0f0 180deg 360deg)").stops.map((stop) => stop.offset)).toEqual([0, 0.25, 0.25, 0.5, 0.5, 1]);
  });

  it("replaces a color hint with Blink's 9 interpolated stops", () => {
    const stops = gradient("linear-gradient(90deg, #f00, 30%, #00f)").stops;
    expect(stops).toHaveLength(11);
    expect(stops[0]).toEqual({ offset: 0, color: "#ff0000" });
    expect(stops.at(-1)).toEqual({ offset: 1, color: "#0000ff" });
    for (let index = 1; index < stops.length; index += 1) expect(stops[index]!.offset).toBeGreaterThanOrEqual(stops[index - 1]!.offset);
  });

  it("clamps a linear stop list running past 0%/100% by interpolating the boundary color", () => {
    expect(gradient("linear-gradient(90deg, #ff0000 -100%, #0000ff 100%)").stops).toEqual([
      { offset: 0, color: "#800080ff" },
      { offset: 1, color: "#0000ff" },
    ]);
  });

  it("extends a radial ending shape instead of cutting off stops past 100%", () => {
    const paint = gradient("radial-gradient(circle, #f00 0%, #00f 150%)");
    expect(paint.type).toBe("radial-gradient");
    if (paint.type !== "radial-gradient") return;
    expect(paint.stops.map((stop) => stop.offset)).toEqual([0, 1]);
    // farthest-corner of a centered 400x300 box is 250px; x1.5 = 375px, over the 300px minor axis.
    expect(paint.radius).toBeCloseTo(375 / 300, 10);
  });
});

describe("gradient geometry", () => {
  it("accepts turn/rad/grad linear angles", () => {
    expect(gradient("linear-gradient(0.25turn, #f00, #00f)")).toMatchObject({ angle: 0 });
    expect(gradient("linear-gradient(200grad, #f00, #00f)")).toMatchObject({ angle: 90 });
  });

  it("derives a corner direction from the box aspect ratio, not a fixed 45deg", () => {
    // to bottom right on 400x300: 180deg - atan(300/400) = 143.13deg CSS, -90deg in runtime space.
    const paint = gradient("linear-gradient(to bottom right, #f00, #00f)");
    if (paint.type !== "linear-gradient") throw new Error("expected linear");
    expect(paint.angle).toBeCloseTo(180 - (Math.atan(300 / 400) * 180) / Math.PI - 90, 10);
    expect(gradient("linear-gradient(to bottom right, #f00, #00f)", { width: 300, height: 300 })).toMatchObject({ angle: 45 });
  });

  it("honors radial extent keywords and explicit sizes instead of always using farthest-corner", () => {
    expect(gradient("radial-gradient(circle closest-side, #f00, #00f)")).toMatchObject({ radius: 0.5 });
    expect(gradient("radial-gradient(circle farthest-side, #f00, #00f)")).toMatchObject({ radius: 200 / 300 });
    expect(gradient("radial-gradient(150px circle at center, #f00, #00f)")).toMatchObject({ radius: 0.5 });
    expect(gradient("radial-gradient(ellipse 100px 60px, #f00, #00f)")).toMatchObject({ radiusX: 0.25, radiusY: 0.2 });
    expect(gradient("radial-gradient(ellipse closest-side, #f00, #00f)")).toMatchObject({ radiusX: 0.5, radiusY: 0.5 });
  });

  it("honors keyword and length gradient positions instead of silently centering", () => {
    expect(gradient("radial-gradient(circle at top left, #f00, #00f)")).toMatchObject({ cx: 0, cy: 0 });
    expect(gradient("radial-gradient(circle at right 100px, #f00, #00f)")).toMatchObject({ cx: 1, cy: 100 / 300 });
    expect(gradient("conic-gradient(from 0.5turn at bottom, #f00, #00f)")).toMatchObject({ from: 180, cx: 0.5, cy: 1 });
  });
});

describe("opacity, border-color and saturate()", () => {
  const compile = (css: string, keyframes = "") => compileHtmlCss(createHtmlCssSource({
    html: `<div id="box"></div>`,
    css: `#box { position: absolute; left: 0; top: 0; width: 100px; height: 100px; ${css} } ${keyframes}`,
  }));

  it("accepts a percentage opacity", () => {
    const result = compile("background: #f00; opacity: 50%;");
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "box")).toMatchObject({ opacity: 0.5 });
  });

  it("animates a percentage opacity keyframe instead of silently holding 1", () => {
    const result = compile("background: #f00; animation: fade 1s linear both;", "@keyframes fade { from { opacity: 0%; } to { opacity: 50%; } }");
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const track = result.protocol?.layers.find((layer) => layer.id === "box")?.tracks?.find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes.map((keyframe) => keyframe.value)).toEqual([{ type: "number", value: 0 }, { type: "number", value: 0.5 }]);
  });

  it("accepts a per-side border-color list", () => {
    expect(compile("border: 2px solid; border-color: #f00 #0f0 #00f #ff0;").status).toBe("success");
  });

  it("lowers saturate() onto the color-adjust saturation channel, allowing oversaturation", () => {
    expect(parseFilter("saturate(180%)", 1920, 16, viewport, "#000000")).toEqual([
      { id: "filter:0", type: "color-adjust", brightness: 0, contrast: 1, saturation: 1.8, hueRotate: 0 },
    ]);
    expect(compile("background: rgba(255, 255, 255, .05); backdrop-filter: blur(12px) saturate(180%);").status).toBe("success");
  });
});
