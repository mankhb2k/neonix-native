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
