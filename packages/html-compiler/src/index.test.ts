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
#gold-01 { position: absolute; left: 0px; top: 0px; width: 960px; height: 540px; background: #14b8a6; display: grid; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.protocol).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({ severity: "error", code: "css-display-unsupported", source: { kind: "css", line: 2 } });
  });
});
