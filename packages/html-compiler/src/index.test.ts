import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { compileHtmlCss, createHtmlCssSource, createNewHtmlProject, DEFAULT_HTML_CSS_COMPOSITION, DEFAULT_NEONIX_HTML_DOCUMENT } from "./index";

const source = createHtmlCssSource({
  html: `<div id="gold-01"></div>`,
  css: `body { margin: 0; background: #081018; }
#gold-01 { position: absolute; left: 480px; top: 270px; width: 960px; height: 540px; background: #14b8a6; opacity: 1; }`,
});

describe("HTML compiler Phase 1 vertical slice", () => {
  it("creates every source with the fixed composition envelope", () => {
    expect(createHtmlCssSource().composition).toEqual(DEFAULT_HTML_CSS_COMPOSITION);
    expect(createNewHtmlProject()).toEqual({
      kind: "neonix-html-source",
      sourceSchemaVersion: 1,
      composition: DEFAULT_HTML_CSS_COMPOSITION,
      html: DEFAULT_NEONIX_HTML_DOCUMENT,
      css: "",
    });
    expect(DEFAULT_NEONIX_HTML_DOCUMENT).toContain('id="neonix-manifest"');
  });

  it("reads the composition manifest from the standard HTML document", () => {
    const result = compileHtmlCss(createNewHtmlProject());
    expect(result.status).toBe("success");
    expect(result.protocol?.composition).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#081018",
      colorSpace: "srgb",
    });
  });

  it("keeps the compiler viewport fixed even when legacy options are supplied", () => {
    const result = compileHtmlCss(source, { composition: { width: 1280, height: 720, fps: 24 } });
    expect(result.status).toBe("success");
    expect(result.protocol?.composition).toMatchObject({ width: 1920, height: 1080, fps: 30 });
  });

  it("compiles a standard HTML document shell", () => {
    const result = compileHtmlCss(createNewHtmlProject({
      html: `<!DOCTYPE html>
<html>
<head>
</head>
<body>
  <div id="blue-rectangle"></div>
</body>
</html>`,
      css: `#blue-rectangle {
  position: absolute;
  left: 720px;
  top: 420px;
  width: 480px;
  height: 240px;
  background: #2563eb;
}`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({ id: "blue-rectangle", type: "shape", style: { fill: "#2563eb" } });
  });

  it("lowers HTML text with exact family, size, weight and emoji fallback assets", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="title">Hello 🚀</div>`,
      css: `#title { position: absolute; left: 100px; top: 100px; width: 800px; height: 120px; color: #ffffff; font-family: "Inter", "Noto Color Emoji"; font-size: 64px; font-weight: 700; }`,
    }), {
      fontAssets: [
        { id: "inter-bold", kind: "font", uri: "/fonts/inter-bold.ttf", mimeType: "font/ttf", family: "Inter", weight: 700, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { id: "noto-emoji", kind: "font", uri: "/fonts/noto-emoji.ttf", mimeType: "font/ttf", family: "Noto Color Emoji", weight: 400, style: "normal", integrity: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      ],
    });
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({
      id: "title",
      type: "text",
      frame: { width: 800, height: 120 },
      payload: { source: { text: "Hello 🚀" }, chunks: [{ spans: [{ font: { families: ["Inter", "Noto Color Emoji"], size: 64, weight: 700 } }] }] },
    });
    expect(result.protocol?.assets?.map((asset) => asset.id)).toEqual(["inter-bold", "noto-emoji"]);
  });

  it("lowers all authored CSS text-align values into Protocol V2 JSON", () => {
    const alignments = [
      ["start", "start"],
      ["end", "end"],
      ["left", "left"],
      ["right", "right"],
      ["center", "center"],
      ["justify", "justify"],
      ["match-parent", "match-parent"],
      ["justify-all", "justify-all"],
    ] as const;
    const html = `<div id="align-start">start alignment</div><div id="align-end">end alignment</div><div id="align-left">left alignment</div><div id="align-right">right alignment</div><div id="align-center">center alignment</div><div id="align-justify">justify alignment</div><div id="align-match-parent">match parent alignment</div><div id="align-justify-all">justify all alignment</div>`;
    const css = [
      "body { margin: 0; background: #081018; }",
      ...alignments.map(([value], index) => `#align-${value} { position: absolute; left: 100px; top: ${100 + index * 100}px; width: 900px; height: 80px; color: #ffffff; font-family: Inter; font-size: 32px; text-align: ${value}; }`),
    ].join("\n");
    const result = compileHtmlCss(createHtmlCssSource({ html, css }), {
      fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    const textLayers = result.protocol?.layers.filter((layer) => layer.type === "text") ?? [];
    expect(textLayers).toHaveLength(alignments.length);
    expect(textLayers.map((layer) => layer.type === "text" ? layer.payload.layout?.textAlign : undefined)).toEqual(alignments.map(([, normalized]) => normalized));
  });

  it("lowers direction, writing-mode and text-decoration into Protocol V2", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="rtl">Ù…Ø±Ø­Ø¨Ø§</div><div id="vertical">VERT</div><div id="decorated">decorated</div>`,
      css: `body { margin: 0; } #rtl, #vertical, #decorated { position: absolute; left: 40px; top: 40px; width: 300px; height: 120px; font-family: Inter; color: #ffffff; } #rtl { direction: rtl; text-align: start; } #vertical { top: 200px; writing-mode: vertical-rl; } #decorated { top: 360px; text-decoration: underline 3px #ff0000 overline line-through; }`,
    }), {
      fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    const rtl = result.protocol?.layers.find((layer) => layer.id === "rtl");
    expect(rtl).toMatchObject({ type: "text", payload: { source: { direction: "rtl", writingMode: "horizontal-tb" }, chunks: [{ textAnchor: "end" }] } });
    const vertical = result.protocol?.layers.find((layer) => layer.id === "vertical");
    expect(vertical).toMatchObject({ type: "text", payload: { source: { direction: "ltr", writingMode: "vertical-rl" } } });
    const decorated = result.protocol?.layers.find((layer) => layer.id === "decorated");
    expect(decorated).toMatchObject({
      type: "text",
      payload: {
        chunks: [{ spans: [{ textDecoration: {
          underline: { fill: "#ff0000", strokeWidth: { value: 3, unit: "px" } },
          overline: { fill: "#ff0000", strokeWidth: { value: 3, unit: "px" } },
          lineThrough: { fill: "#ff0000", strokeWidth: { value: 3, unit: "px" } },
        } }] }],
      },
    });
  });

  it("emits the text content box separately from the border-box frame", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box">content box</div>`,
      css: `body { margin: 0; } #box { position: absolute; left: 50px; top: 50px; width: 200px; height: 80px; margin-left: 30px; padding: 10px 20px; border: 2px solid #ffffff; font-family: Inter; text-align: center; }`,
    }), {
      fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    const textLayer = result.protocol?.layers.find((layer) => layer.type === "text");
    expect(textLayer?.frame).toMatchObject({ width: 244, height: 104 });
    expect(textLayer?.type === "text" ? textLayer.payload.layout : undefined).toMatchObject({ contentWidth: 200, contentOffsetX: 22, contentOffsetY: 12 });
  });

  it("lowers letter-spacing, word-spacing and white-space into the text contract", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="typography">A  B\nC</div>`,
      css: `body { margin: 0; } #typography { position: absolute; left: 40px; top: 40px; width: 300px; height: 120px; font-family: Inter; letter-spacing: 2px; word-spacing: 8px; white-space: pre-wrap; }`,
    }), {
      fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    const textLayer = result.protocol?.layers.find((layer) => layer.type === "text");
    expect(textLayer?.type === "text" ? textLayer.payload : undefined).toMatchObject({
      source: { text: "A  B\nC" },
      layout: { whiteSpace: "pre-wrap", wrap: "word" },
    });
    const span = textLayer?.type === "text" ? textLayer.payload.chunks[0]?.spans[0] : undefined;
    expect(span?.letterSpacing).toEqual({ value: 2, unit: "px" });
    expect(span?.wordSpacing).toEqual({ value: 8, unit: "px" });
  });

  it("lowers deterministic text overflow and rendering capabilities", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="overflow">A deterministic single-line overflow example</div><div id="precision">Geometric text</div>`,
      css: `body { margin: 0; } #overflow, #precision { position: absolute; left: 40px; top: 40px; width: 200px; height: 60px; font-family: Inter; font-size: 32px; } #overflow { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } #precision { top: 140px; text-rendering: geometricPrecision; }`,
    }), {
      fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    const overflow = result.protocol?.layers.find((layer) => layer.id === "overflow");
    expect(overflow).toMatchObject({
      type: "text",
      clipPath: "html-text-clip-0",
      payload: { source: { textRendering: "auto" }, layout: { textOverflow: "ellipsis", maxLines: 1, whiteSpace: "nowrap", wrap: "none" } },
    });
    expect(result.protocol?.clipPaths).toEqual([{ id: "html-text-clip-0", clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: 0, y: 0, width: 200, height: 60 }] }]);
    expect(result.protocol?.layers.find((layer) => layer.id === "precision")).toMatchObject({ type: "text", payload: { source: { textRendering: "geometricPrecision" } } });
  });

  it("requires deterministic clipping for text-overflow ellipsis", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="overflow">text</div>`,
      css: `#overflow { position: absolute; width: 200px; height: 60px; font-family: Inter; text-overflow: ellipsis; }`,
    }), { fontAssets: [{ id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }] });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-text-overflow-requires-clipping");
  });

  it("lowers outline as paint-only geometry without inflating the layout frame", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="outlined"></div>`,
      css: `#outlined { position: absolute; left: 240px; top: 180px; width: 320px; height: 160px; background: #172554; outline: 12px solid #facc15; outline-offset: 18px; }`,
    }));
    expect(result.status).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    const group = result.protocol?.layers.find((layer) => layer.id === "outlined");
    const outlines = result.protocol?.layers.filter((layer) => layer.id.startsWith("outlined::outline")) ?? [];
    expect(group).toMatchObject({ type: "group", frame: { width: 320, height: 160 } });
    expect(outlines).toHaveLength(4);
    expect(outlines.every((layer) => layer.parentLayerId === "outlined" && layer.type === "shape")).toBe(true);
    expect(outlines[0]).toMatchObject({ frame: { width: 320, height: 160 }, style: { fill: "#facc15" }, payload: { shape: "polygon" } });
  });

  it("lowers text-shadow and box-shadow into ordered Protocol V2 effects", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box-shadow"></div><div id="text-shadow">Shadow</div>`,
      css: `#box-shadow { position: absolute; left: 240px; top: 180px; width: 320px; height: 160px; background: #2563eb; box-shadow: 12px 16px 24px #00000099; }
#text-shadow { position: absolute; left: 240px; top: 420px; width: 600px; height: 120px; color: #ffffff; font-family: Inter; font-size: 64px; font-weight: 700; text-shadow: 4px 6px 8px #38bdf899; }`,
    }), {
      fontAssets: [{ id: "inter-bold", kind: "font", uri: "/fonts/inter-bold.ttf", mimeType: "font/ttf", family: "Inter", weight: 700, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    });
    expect(result.status).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    expect(result.protocol?.layers.find((layer) => layer.id === "box-shadow")).toMatchObject({
      type: "group",
      frame: { width: 320, height: 160 },
      effects: [{ type: "shadow", source: "box", offset: { x: 12, y: 16 }, blur: 24, spread: 0, inset: false, color: "#00000099" }],
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "text-shadow")).toMatchObject({
      type: "text",
      effects: [{ type: "shadow", source: "alpha", offset: { x: 4, y: 6 }, blur: 8, spread: 0, inset: false, color: "#38bdf899" }],
    });
  });

  it("lowers CSS filter functions as an ordered semantic effect list", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="filtered"></div>`,
      css: '#filtered { position: absolute; left: 240px; top: 180px; width: 320px; height: 160px; background: #38bdf8; filter: brightness(.8) blur(6px) grayscale(.25) opacity(.6) drop-shadow(8px 10px 12px #00000099); }',
    }));
    expect(result.status).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    const filtered = result.protocol?.layers.find((layer) => layer.id === "filtered");
    expect(filtered).toMatchObject({
      type: "group",
      effects: [
        { type: "color-adjust", contrast: 0.8, saturation: 1, hueRotate: 0 },
        { type: "blur", radius: 6 },
        { type: "grayscale", amount: 0.25 },
        { type: "filter-opacity", amount: 0.6 },
        { type: "shadow", source: "alpha", offset: { x: 8, y: 10 }, blur: 12, spread: 0, inset: false },
      ],
    });
    expect((filtered?.effects?.[0] as { brightness?: number } | undefined)?.brightness).toBeCloseTo(-0.1, 10);
  });

  it("fails closed for box-shadow spread and inset until runtime morphology is available", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="shadow"></div>`,
      css: `#shadow { position: absolute; width: 200px; height: 100px; background: #2563eb; box-shadow: 0 8px 12px 6px #00000099 inset; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-box-shadow-spread-inset-unsupported");
  });

  it("lowers Gold Test 01 to valid Atomic Protocol V2", () => {
    const result = compileHtmlCss(source);
    expect(result.status).toBe("success");
    expect(result.diagnostics).toEqual([]);
    expect(result.protocol).not.toBeNull();
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    expect(result.protocol).toMatchObject({
      format: "motion-protocol",
      formatVersion: 2,
      composition: { width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" },
      layers: [{
        id: "gold-01",
        type: "shape",
        frame: { width: 960, height: 540 },
        transform: { translate: { x: 480, y: 270, z: 0 } },
        opacity: 1,
        timing: { start: 0, duration: 1000 },
        payload: { shape: "rectangle" },
        style: { fill: "#14b8a6" },
      }],
    });
  });

  it("returns an explicit diagnostic for unsupported CSS", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="gold-01"></div>`,
      css: `body { margin: 0; background: #081018; }
#gold-01 { position: absolute; left: 0px; top: 0px; width: 960px; height: 540px; background: #14b8a6; display: inline; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.protocol).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({ severity: "error", code: "css-display-unsupported", source: { kind: "css", line: 2 } });
  });
});
