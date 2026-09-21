import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { compileDocument, compileHtmlCss, compileProject, createHtmlCssProject, createHtmlCssSource, createNewHtmlProject, DEFAULT_HTML_CSS_COMPOSITION, DEFAULT_NEONIX_HTML_DOCUMENT } from "./index";

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
    expect(DEFAULT_NEONIX_HTML_DOCUMENT).not.toContain("neonix-manifest");
  });

  it("compiles the canonical project contract without an embedded manifest", () => {
    const result = compileProject(createHtmlCssProject());
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

  it("compiles a self-contained neonix-document with embedded CSS resources", () => {
    const result = compileDocument({
      html: `<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1920,"fps":24,"background":"#081018","colorSpace":"srgb"}}'>
    <style data-neonix-bundle>
      body { margin: 0; }
      #scene { position: absolute; left: 10vw; top: 10vh; width: 50vw; height: 20vh; background: #14b8a6; }
    </style>
    <style>
      #scene { opacity: 0.75; }
    </style>
  </head>
  <body><div id="scene"></div></body>
</html>`,
    });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.source.css).toContain("opacity: 0.75");
    expect(result.protocol?.composition).toMatchObject({ width: 1080, height: 1920, fps: 24 });
    expect(result.protocol?.layers[0]).toMatchObject({ id: "scene", style: { fill: "#14b8a6" }, opacity: 0.75 });
  });

  it("rejects a document without the exact V2 metadata contract", () => {
    const result = compileDocument({ html: "<html><head></head><body></body></html>" });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-document-metadata-missing");
  });

  it("reports duplicate metadata instead of choosing one document envelope", () => {
    const meta = `<meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>`;
    const result = compileDocument({ html: `<html><head>${meta}${meta}</head><body></body></html>` });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-document-metadata-duplicate");
  });

  it("rejects non-CSS inline style resources", () => {
    const result = compileDocument({
      html: `<html><head><meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'><style type="text/less">#scene {}</style></head><body><div id="scene"></div></body></html>`,
    });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-document-style-unsupported");
  });

  it("takes the viewport from neonix.config.json for portrait and square projects", () => {
    const result = compileProject({
      html: `<div id="shape"></div>`,
      css: `#shape { position: absolute; left: 10vw; top: 10vh; width: 50vw; height: 20vh; background: #14b8a6; }`,
      config: {
        kind: "neonix-html-project",
        schemaVersion: 1,
        composition: { width: 1080, height: 1920, fps: 24, background: "#081018", colorSpace: "srgb" },
      },
    });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.protocol?.composition).toMatchObject({ width: 1080, height: 1920, fps: 24 });
    expect(result.protocol?.layers[0]).toMatchObject({ frame: { width: 540, height: 384 }, transform: { translate: { x: 108, y: 192 } } });
  });

  it("preserves nested inline font semantics as Protocol text spans", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<p id="mixed">Prefix <strong>bold</strong> <em>italic</em></p>`,
      css: `body { margin: 0; } #mixed { position: absolute; left: 100px; top: 100px; width: 900px; height: 80px; color: #ffffff; font-family: Inter; font-size: 48px; line-height: 60px; }`,
    }), {
      fontAssets: [
        { id: "inter-regular", kind: "font", uri: "/fonts/inter.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { id: "inter-bold", kind: "font", uri: "/fonts/inter-bold.ttf", mimeType: "font/ttf", family: "Inter", weight: 700, style: "normal", integrity: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
        { id: "inter-italic", kind: "font", uri: "/fonts/inter-italic.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "italic", integrity: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" },
      ],
    });
    expect(result.status).toBe("success");
    const layer = result.protocol?.layers.find((candidate) => candidate.id === "mixed");
    expect(layer?.type).toBe("text");
    if (layer?.type !== "text") return;
    expect(layer.payload.source.text).toBe("Prefix bold italic");
    expect(layer.payload.chunks[0]?.spans).toMatchObject([
      { sourceRange: { start: 0, end: 7 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["inter-regular"] },
      { sourceRange: { start: 7, end: 11 }, font: { weight: 700, style: "normal" }, resolvedFontAssetIds: ["inter-bold"] },
      { sourceRange: { start: 11, end: 12 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["inter-regular"] },
      { sourceRange: { start: 12, end: 18 }, font: { weight: 400, style: "italic" }, resolvedFontAssetIds: ["inter-italic"] },
    ]);
  });

  it("lowers background-clip text gradients into Protocol text fill paints", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="linear">Linear</div><div id="radial">Radial</div><div id="conic">Conic</div>`,
      css: `body { margin: 0; } #linear, #radial, #conic { position: absolute; left: 40px; width: 640px; height: 100px; color: transparent; font-family: Inter; font-size: 72px; font-weight: 700; background-repeat: no-repeat; background-clip: text; } #linear { top: 40px; background: linear-gradient(90deg, #22d3ee, #c084fc); } #radial { top: 180px; background: radial-gradient(circle at 50% 50%, #fef3c7, #be123c); } #conic { top: 320px; background: conic-gradient(from 45deg at 50% 50%, #14b8a6, #7c3aed); }`,
    }), {
      fontAssets: [{ id: "inter-bold", kind: "font", uri: "/fonts/inter-bold.ttf", mimeType: "font/ttf", family: "Inter", weight: 700, style: "normal", integrity: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
    });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const gradientTypes = [
      { id: "linear", type: "linear-gradient" },
      { id: "radial", type: "radial-gradient" },
      { id: "conic", type: "conic-gradient" },
    ] as const;
    for (const { id, type } of gradientTypes) {
      const layer = result.protocol?.layers.find((candidate) => candidate.id === id);
      expect(layer?.type).toBe("text");
      if (layer?.type !== "text") continue;
      expect(layer.payload.chunks[0]?.spans[0]?.fill).toMatchObject({ type });
    }
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

  it("accepts CSS unitless zero lengths in filter drop-shadow", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="zero-shadow"></div>`,
      css: '#zero-shadow { position: absolute; left: 240px; top: 180px; width: 320px; height: 160px; background: #a78bfa; filter: drop-shadow(0 0 0 #38bdf899); }',
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "zero-shadow")).toMatchObject({
      effects: [{ type: "shadow", source: "alpha", offset: { x: 0, y: 0 }, blur: 0 }],
    });
  });

  it("lowers CSS blend mode and isolation to compositing state", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="multiply"></div><div id="isolated"><div id="screen-child"></div></div><div id="combined"></div>`,
      css: `body { margin: 0; background: #172554; }
#multiply { position: absolute; left: 120px; top: 120px; width: 240px; height: 120px; background: #facc15; mix-blend-mode: multiply; }
#isolated { position: absolute; left: 420px; top: 120px; width: 300px; height: 160px; isolation: isolate; background: #1e3a8a; }
#screen-child { position: absolute; left: 60px; top: 40px; width: 180px; height: 80px; background: #38bdf8; mix-blend-mode: screen; }
#combined { position: absolute; left: 780px; top: 120px; width: 240px; height: 120px; background: #f97316; opacity: .7; mix-blend-mode: screen; filter: grayscale(.4); }`,
    }));
    expect(result.status).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    expect(result.protocol?.layers.find((layer) => layer.id === "multiply")).toMatchObject({
      type: "group",
      composite: { blendMode: "multiply" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "isolated")).toMatchObject({
      type: "group",
      composite: { blendMode: "normal", isolation: "isolate" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "screen-child")).toMatchObject({
      type: "group",
      composite: { blendMode: "screen" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "combined")).toMatchObject({
      type: "group",
      opacity: 0.7,
      composite: { blendMode: "screen" },
      effects: [{ type: "grayscale", amount: 0.4 }],
    });
  });

  it("lowers CSS perspective properties to a group render3d context", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="scene"><div id="card"></div></div>`,
      css: `body { margin: 0; } #scene { position: absolute; left: 300px; top: 180px; width: 600px; height: 400px; perspective: 800px; perspective-origin: 25% 75%; transform-style: preserve-3d; } #card { position: absolute; left: 120px; top: 100px; width: 240px; height: 160px; background: #38bdf8; transform: translateZ(120px) rotateY(24deg); backface-visibility: hidden; }`,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    expect(result.protocol?.layers.find((layer) => layer.id === "scene")).toMatchObject({
      type: "group",
      render3d: { transformStyle: "preserve-3d", perspective: { distance: 800, origin: { x: 150, y: 300 } } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({
      transform: {
        operations: [
          { type: "extension", name: "motion.translate3d", value: { x: 0, y: 0, z: 120 } },
          { type: "extension", name: "motion.rotateY", value: 24 },
        ],
      },
      backfaceVisibility: "hidden",
    });
  });

  it("keeps transform perspective ordered separately from parent perspective", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="perspective"></div>`,
      css: `#perspective { position: absolute; left: 420px; top: 240px; width: 320px; height: 180px; background: #a78bfa; transform-origin: 50% 50%; transform: perspective(600px) rotateX(18deg) translateZ(80px); }`,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layer = result.protocol?.layers.find((item) => item.id === "perspective");
    expect(layer).toMatchObject({
      transform: {
        operations: [
          { type: "extension", name: "motion.perspective", value: 600 },
          { type: "extension", name: "motion.rotateX", value: 18 },
          { type: "extension", name: "motion.translate3d", value: { x: 0, y: 0, z: 80 } },
        ],
      },
    });
  });

  it("lowers nested perspective contexts without collapsing their distances", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="outer"><div id="inner"><div id="card"></div></div></div>`,
      css: `body { margin: 0; } #outer { position: absolute; left: 200px; top: 120px; width: 1000px; height: 700px; perspective: 900px; perspective-origin: 15% 80%; transform-style: preserve-3d; } #inner { position: absolute; left: 180px; top: 100px; width: 700px; height: 480px; perspective: 420px; perspective-origin: 85% 20%; transform-style: preserve-3d; } #card { position: absolute; left: 200px; top: 100px; width: 280px; height: 180px; background: #38bdf8; transform: translateZ(140px) rotateY(22deg); }`,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layers = result.protocol?.layers ?? [];
    expect(layers.filter((layer) => layer.type === "group" && layer.render3d?.perspective)).toHaveLength(2);
    expect(layers.find((layer) => layer.id === "outer")).toMatchObject({
      render3d: { perspective: { distance: 900, origin: { x: 150, y: 560 } } },
    });
    expect(layers.find((layer) => layer.id === "inner")).toMatchObject({
      render3d: { perspective: { distance: 420, origin: { x: 595, y: 96 } } },
    });
    expect(layers.find((layer) => layer.id === "card")?.parentLayerId).toBe("inner");
  });

  it("lowers overflow clipping as a CSS flat 3D boundary", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="outer"><div id="inner"><div id="card"></div></div></div>`,
      css: `body { margin: 0; } #outer { position: absolute; left: 180px; top: 140px; width: 1580px; height: 800px; perspective: 880px; transform-style: preserve-3d; overflow: hidden; } #inner { position: absolute; left: 980px; top: 180px; width: 520px; height: 360px; perspective: 360px; transform-style: preserve-3d; overflow: hidden; } #card { position: absolute; left: 170px; top: 70px; width: 360px; height: 260px; background: #fb7185; transform: translateZ(170px) rotateY(-38deg); }`,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layers = result.protocol?.layers ?? [];
    expect(layers.find((layer) => layer.id === "outer")).toMatchObject({
      type: "group",
      clipPath: "html-overflow-clip-0",
      render3d: { transformStyle: "flat", perspective: { distance: 880 } },
    });
    expect(layers.find((layer) => layer.id === "inner")).toMatchObject({
      type: "group",
      clipPath: "html-overflow-clip-1",
      render3d: { transformStyle: "flat", perspective: { distance: 360 } },
    });
  });

  it("fails closed for invalid CSS 3D values", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="invalid"></div>`,
      css: `#invalid { position: absolute; width: 200px; height: 100px; perspective: 0px; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-perspective-invalid");
  });

  it("lowers CSS clip-path shapes into geometric V2 clip paths", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="inset"></div><div id="circle"></div><div id="ellipse"></div><div id="triangle"></div><div id="hole"></div><div id="combined"><div id="combined-child"></div></div>`,
      css: `body { margin: 0; }
#inset, #circle, #ellipse, #triangle, #hole, #combined { position: absolute; width: 300px; height: 180px; background: #38bdf8; }
#inset { left: 40px; top: 40px; clip-path: inset(20px 30px round 18px / 10px); }
#circle { left: 380px; top: 40px; clip-path: circle(65px at 30% 60%); }
#ellipse { left: 720px; top: 40px; clip-path: ellipse(110px 55px at 65% 35%); }
#triangle { left: 1060px; top: 40px; clip-path: polygon(10% 90%, 50% 10%, 90% 90%); }
#hole { left: 1400px; top: 40px; clip-path: path(evenodd, "M 0 0 H 300 V 180 H 0 Z M 80 40 H 220 V 140 H 80 Z"); }
#combined { left: 40px; top: 300px; overflow: hidden; transform: rotate(4deg); clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
#combined-child { position: absolute; left: -40px; top: -20px; width: 380px; height: 220px; background: #f97316; }`,
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    const clipIds = result.protocol?.layers.filter((layer) => layer.clipPath).map((layer) => layer.clipPath);
    expect(clipIds).toHaveLength(6);
    expect(result.protocol?.clipPaths).toHaveLength(6);
    expect(result.protocol?.clipPaths?.some((clip) => clip.children[0]?.type === "path" && clip.children[0].contours[0]?.segments.some((segment) => segment.kind === "arc"))).toBe(true);
    expect(result.protocol?.clipPaths?.some((clip) => clip.children[0]?.type === "path" && clip.children[0].fillRule === "evenodd")).toBe(true);
    expect(result.protocol?.layers.find((layer) => layer.id === "combined")).toMatchObject({ clipPath: expect.any(String), transform: { operations: expect.any(Array) } });
  });

  it("lowers box-shadow spread to a signed spread field the runtime morphology op consumes", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="shadow"></div>`,
      css: `#shadow { position: absolute; width: 200px; height: 100px; background: #2563eb; box-shadow: 0 8px 12px 6px #00000099; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "shadow")).toMatchObject({
      effects: [{ type: "shadow", source: "box", blur: 12, spread: 6, inset: false }],
    });
  });

  it("lowers a negative box-shadow spread (contraction) the same way", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="shadow"></div>`,
      css: `#shadow { position: absolute; width: 200px; height: 100px; background: #2563eb; box-shadow: 0 0 12px -6px #00000099; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "shadow")).toMatchObject({
      effects: [{ type: "shadow", source: "box", blur: 12, spread: -6, inset: false }],
    });
  });

  it("repeats an odd-length stroke-dasharray to an even length per SVG spec", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<svg id="wrap"><path id="line" d="M 0 0 L 100 0"></path></svg>`,
      css: `#wrap { position: absolute; width: 200px; height: 20px; } #line { stroke: #2563eb; stroke-width: 4px; stroke-dasharray: 20 10 5; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "line")).toMatchObject({
      style: { strokeDash: { array: [20, 10, 5, 20, 10, 5] } },
    });
  });

  it("leaves an already-even-length stroke-dasharray untouched", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<svg id="wrap"><path id="line" d="M 0 0 L 100 0"></path></svg>`,
      css: `#wrap { position: absolute; width: 200px; height: 20px; } #line { stroke: #2563eb; stroke-width: 4px; stroke-dasharray: 20 10; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "line")).toMatchObject({
      style: { strokeDash: { array: [20, 10] } },
    });
  });

  it("lowers an inset box-shadow as an inner compositing effect", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="shadow"></div>`,
      css: `#shadow { position: absolute; width: 200px; height: 100px; background: #2563eb; box-shadow: inset 0 0 24px #22d3ee; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "shadow")).toMatchObject({
      effects: [{ type: "shadow", source: "box", blur: 24, spread: 0, inset: true }],
    });
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
