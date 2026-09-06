import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";
import { parseAnimationStyles } from "../compiler/css-parser";

const html = "<!doctype html><html><body><div id=\"box\"></div></body></html>";
const composition = { width: 1920 as const, height: 1080 as const, fps: 30 as const, background: "#081018" as const, colorSpace: "srgb" as const };

describe("CSS animation lowering", () => {
  it("lowers keyframes and playback metadata to V2 tracks", () => {
    const result = compileHtmlCss({ kind: "neonix-html-source", sourceSchemaVersion: 1, composition, html, css: `
      @keyframes move { from { opacity: 0; transform: translateX(0px); } to { opacity: 1; transform: translateX(100px); } }
      #box { width: 100px; height: 100px; background-color: #00aaff; animation-name: move; animation-duration: 1s; animation-delay: 100ms; animation-iteration-count: 2; animation-direction: alternate; animation-fill-mode: both; }
    ` });
    expect(result.status).toBe("success");
    const tracks = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []) ?? [];
    expect(tracks.map((track) => track.path)).toEqual(expect.arrayContaining(["opacity", "transform.translate.x"]));
    expect(tracks[0]?.playback).toMatchObject({ durationMs: 1000, delayMs: 100, iterations: 2, direction: "alternate", fillMode: "both" });
  });

  it("lowers perspective distance into a group render3d track", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"scene\"><div id=\"card\"></div></div>",
      css: `
        @keyframes camera-distance { from { perspective: 400px; } to { perspective: 900px; } }
        #scene { position: absolute; left: 200px; top: 120px; width: 800px; height: 500px; perspective: 400px; perspective-origin: 50% 50%; transform-style: preserve-3d; animation-name: camera-distance; animation-duration: 1s; animation-fill-mode: both; animation-timing-function: linear; }
        #card { position: absolute; left: 200px; top: 120px; width: 240px; height: 160px; background: #22d3ee; transform: translateZ(120px) rotateY(-18deg); }
      `,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const scene = result.protocol?.layers.find((layer) => layer.id === "scene");
    const track = scene?.tracks?.find((candidate) => candidate.path === "render3d.perspective.distance");
    expect(scene?.render3d?.perspective).toEqual({ distance: 400, origin: { x: 400, y: 250 } });
    expect(track?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 400 },
      { type: "number", value: 900 },
    ]);
  });

  it("lowers perspective-origin X and Y into a typed vec2 track", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"scene\"><div id=\"card\"></div></div>",
      css: `
        @keyframes camera-origin { from { perspective-origin: 10% 20%; } to { perspective-origin: right bottom; } }
        #scene { position: absolute; width: 800px; height: 500px; perspective: 600px; perspective-origin: 10% 20%; animation-name: camera-origin; animation-duration: 1s; animation-fill-mode: both; animation-timing-function: linear; }
        #card { position: absolute; width: 240px; height: 160px; background: #a78bfa; transform: translateZ(100px); }
      `,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const scene = result.protocol?.layers.find((layer) => layer.id === "scene");
    const track = scene?.tracks?.find((candidate) => candidate.path === "render3d.perspective.origin");
    expect(track?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "vec2", value: [80, 100] },
      { type: "vec2", value: [800, 500] },
    ]);
  });

  it("lowers CSS offset-* to a layer-owned motion path and typed distance track", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes travel { from { offset-distance: 0%; } to { offset-distance: 100%; } }
        #box { position: absolute; width: 80px; height: 40px; background: #22d3ee; offset-path: path(\"M 100 100 L 500 100\"); offset-distance: 0%; offset-rotate: auto 15deg; offset-anchor: 50% 100%; animation-name: travel; animation-duration: 1s; animation-timing-function: linear; animation-fill-mode: both; }
      `,
    }));
    expect(result.status).toBe("success");
    const layer = result.protocol?.layers.find((candidate) => candidate.id === "box");
    expect(layer?.motion).toMatchObject({
      offsetPath: { type: "path", coordinateSpace: "parent-local", referenceBox: "border-box" },
      offsetDistance: 0,
      offsetRotate: { mode: "auto", angle: 15 },
      offsetAnchor: { x: 40, y: 40 },
    });
    expect(layer?.tracks?.find((track) => track.path === "motion.offsetDistance")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 0 },
      { type: "number", value: 1 },
    ]);
  });

  it("preserves steps count and position", () => {
    const result = compileHtmlCss({ kind: "neonix-html-source", sourceSchemaVersion: 1, composition, html, css: `
      @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
      #box { width: 20px; height: 20px; animation-name: pulse; animation-duration: 1s; animation-timing-function: steps(4, start); }
    ` });
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes[0]?.easing).toMatchObject({ type: "step", count: 4, position: "jump-start" });
  });

  it.each([
    ["linear", { type: "linear" }],
    ["steps(4, jump-end)", { type: "step", count: 4, position: "jump-end" }],
    ["cubic-bezier(0.25, 0.1, 0.25, 1)", { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }],
  ] as const)("lowers %s to a typed V2 easing", (timing, expected) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes easing { from { opacity: 0; } to { opacity: 1; } }
        #box { width: 20px; height: 20px; animation-name: easing; animation-duration: 1s; animation-timing-function: ${timing}; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes[0]?.easing).toMatchObject(expected);
  });

  it("keeps keyframe-local easing on the segment that authored it", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes easing-segments {
          from { opacity: 0; animation-timing-function: steps(2, jump-start); }
          50% { opacity: 0.5; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1); }
          to { opacity: 1; }
        }
        #box { width: 20px; height: 20px; animation-name: easing-segments; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes.map((keyframe) => keyframe.easing)).toEqual([
      { type: "step", count: 2, position: "jump-start" },
      { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
      { type: "linear" },
    ]);
  });

  it.each([
    "steps(0, jump-end)",
    "cubic-bezier(2, 0, 1, 1)",
  ])("returns a diagnostic for invalid timing function %s", (timing) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes invalid-easing { from { opacity: 0; } to { opacity: 1; } }
        #box { width: 20px; height: 20px; animation-name: invalid-easing; animation-duration: 1s; animation-timing-function: ${timing}; }
      `,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-animation-easing-invalid");
  });

  it("keeps layout position when a keyframe transform is sampled", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes move { from { transform: translateX(0px) rotate(-8deg); } to { transform: translateX(260px) rotate(8deg); } }
        #box { position: absolute; left: 500px; top: 400px; width: 360px; height: 180px; animation-name: move; animation-duration: 1s; transform-origin: center; }
      `,
    }));
    expect(result.status).toBe("success");
    const layer = result.protocol?.layers.find((candidate) => candidate.id === "box");
    const tracks = layer?.tracks ?? [];
    expect(layer?.transform.translate).toMatchObject({ x: 500, y: 400 });
    expect(layer?.transform.anchor).toMatchObject({ x: 180, y: 90 });
    expect(tracks.find((track) => track.path === "transform.translate.x")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 500 },
      { type: "number", value: 760 },
    ]);
    expect(tracks.find((track) => track.path === "transform.translate.y")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 400 },
      { type: "number", value: 400 },
    ]);
  });

  it("lowers scale and rotate components without losing the CSS origin", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes transform { from { transform: scale(0.5) rotate(-20deg); } to { transform: scale(1.25) rotate(20deg); } }
        #box { position: absolute; left: 500px; top: 400px; width: 360px; height: 180px; animation-name: transform; animation-duration: 1s; animation-timing-function: linear; transform-origin: 25% 75%; }
      `,
    }));
    expect(result.status).toBe("success");
    const layer = result.protocol?.layers.find((candidate) => candidate.id === "box");
    expect(layer?.transform.anchor).toMatchObject({ x: 90, y: 135 });
    expect(layer?.tracks?.find((track) => track.path === "transform.scale.x")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 0.5 },
      { type: "number", value: 1.25 },
    ]);
    expect(layer?.tracks?.find((track) => track.path === "transform.rotate.z")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: -20 },
      { type: "number", value: 20 },
    ]);
  });

  it("keeps RGBA channels typed for background-color animation", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes tint { from { background-color: rgba(34, 211, 238, 0.25); } to { background-color: rgba(249, 115, 22, 0.85); } }
        #box { position: absolute; left: 600px; top: 360px; width: 300px; height: 160px; animation-name: tint; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.find((candidate) => candidate.id === "box::paint")?.tracks?.find((candidate) => candidate.path === "style.fill");
    expect(track?.keyframes.every((keyframe) => keyframe.value.type === "color")).toBe(true);
    expect(track?.keyframes[0]?.value).toMatchObject({ type: "color", value: [34 / 255, 211 / 255, 238 / 255, 64 / 255] });
  });

  it("lowers border-box width and height to frame tracks on the group and paint", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes resize { from { width: 240px; height: 120px; } to { width: 520px; height: 300px; } }
        #box { position: absolute; left: 700px; top: 340px; width: 240px; height: 120px; box-sizing: border-box; padding: 20px; background: #22d3ee; animation-name: resize; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const group = result.protocol?.layers.find((candidate) => candidate.id === "box");
    const paint = result.protocol?.layers.find((candidate) => candidate.id === "box::paint");
    expect(group?.tracks?.find((track) => track.path === "frame.width")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 240 },
      { type: "number", value: 520 },
    ]);
    expect(paint?.tracks?.find((track) => track.path === "frame.height")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 120 },
      { type: "number", value: 300 },
    ]);
  });

  it("keeps animated border color and width on the generated border paint pass", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes border-paint { from { border-color: #22d3ee; border-width: 8px; } to { border-color: #f97316; border-width: 18px; } }
        #box { position: absolute; left: 600px; top: 360px; width: 420px; height: 220px; border: 8px solid #22d3ee; background: #1e3a8a; animation-name: border-paint; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const border = result.protocol?.layers.find((candidate) => candidate.id === "box::border");
    expect(border?.tracks?.map((track) => track.path)).toEqual(expect.arrayContaining(["style.stroke", "style.strokeWidth"]));
    expect(border?.tracks?.find((track) => track.path === "style.strokeWidth")?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 8 },
      { type: "number", value: 18 },
    ]);
  });

  it("preserves three authored keyframe offsets in milliseconds", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes three-stops { 0% { opacity: 0; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        #box { width: 100px; height: 100px; animation-name: three-stops; animation-duration: 2s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes.map((keyframe) => keyframe.time)).toEqual([0, 1000, 2000]);
    expect(track?.keyframes.map((keyframe) => keyframe.value)).toEqual([
      { type: "number", value: 0 },
      { type: "number", value: 0.4 },
      { type: "number", value: 1 },
    ]);
  });

  it("uses the underlying computed value before a missing first keyframe", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes missing-start { 30% { opacity: 0.35; } to { opacity: 1; } }
        #box { width: 100px; height: 100px; opacity: 0.1; animation-name: missing-start; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes.map((keyframe) => keyframe.time)).toEqual([0, 300, 1000]);
    expect(track?.keyframes[0]?.value).toEqual({ type: "number", value: 0.1 });
    expect(track?.keyframes.slice(1).every((keyframe) => keyframe.easing?.type === "linear")).toBe(true);
    expect(result.protocol?.layers.find((layer) => layer.id === "box")?.opacity).toBe(0.1);
    expect(result.protocol?.layers.find((layer) => layer.id === "box::paint")?.opacity).toBe(1);
  });

  it("lowers different keyframe names independently on sibling layers", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"fade\"></div><div id=\"tint\"></div>",
      css: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tint { from { background-color: #22d3ee; } to { background-color: #f97316; } }
        #fade { position: absolute; left: 40px; top: 40px; width: 100px; height: 100px; background: #22d3ee; animation-name: fade-in; animation-duration: 1s; }
        #tint { position: absolute; left: 180px; top: 40px; width: 100px; height: 100px; animation-name: tint; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const fade = result.protocol?.layers.find((layer) => layer.id === "fade");
    const tint = result.protocol?.layers.find((layer) => layer.id === "tint::paint");
    expect(fade?.tracks?.some((track) => track.path === "opacity")).toBe(true);
    expect(tint?.tracks?.some((track) => track.path === "style.fill")).toBe(true);
  });

  it("resolves duplicate keyframe offsets by source order per property", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes duplicate-offset { from { opacity: 0; } 50% { opacity: 0.2; } 50% { opacity: 0.8; } to { opacity: 1; } }
        #box { width: 100px; height: 100px; animation-name: duplicate-offset; animation-duration: 1s; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.keyframes.map((keyframe) => keyframe.time)).toEqual([0, 500, 1000]);
    expect(track?.keyframes[1]?.value).toEqual({ type: "number", value: 0.8 });
  });

  it("returns a diagnostic for an unknown animation name", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `#box { width: 100px; height: 100px; animation-name: does-not-exist; animation-duration: 1s; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-animation-name-unknown");
  });

  it.each([
    ["none", 300, "none", "running"],
    ["backwards", 300, "backwards", "running"],
    ["forwards", 0, "forwards", "running"],
    ["both", 300, "both", "running"],
    ["negative", -350, "both", "running"],
    ["paused", 0, "both", "paused"],
  ] as const)("lowers %s delay/fill/playback metadata", (_case, delay, fillMode, playState) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes state { from { opacity: 0.1; } to { opacity: 0.9; } }
        #box { width: 100px; height: 100px; opacity: 0.4; animation-name: state; animation-duration: 700ms; animation-delay: ${delay}ms; animation-fill-mode: ${fillMode}; animation-play-state: ${playState}; animation-timing-function: linear; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.playback).toMatchObject({ durationMs: 700, delayMs: delay, fillMode, playState });
  });

  it.each([
    ["two", "2", 2],
    ["fractional", "2.5", 2.5],
    ["infinite", "infinite", "infinite"],
  ] as const)("preserves %s iteration count in playback metadata", (_case, count, expected) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: "<div id=\"box\"></div>",
      css: `
        @keyframes iterations { from { opacity: 0; } to { opacity: 1; } }
        #box { width: 100px; height: 100px; animation-name: iterations; animation-duration: 500ms; animation-iteration-count: ${count}; animation-direction: alternate-reverse; }
      `,
    }));
    expect(result.status).toBe("success");
    const track = result.protocol?.layers.flatMap((layer) => layer.tracks ?? []).find((candidate) => candidate.path === "opacity");
    expect(track?.playback).toMatchObject({ durationMs: 500, iterations: expected, direction: "alternate-reverse" });
  });
});
