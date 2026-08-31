import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { compileHtmlCss, createHtmlCssSource } from "./index";

const source = createHtmlCssSource({
  html: `<div id="gold-01"></div>`,
  css: `body { margin: 0; background: #081018; }
#gold-01 { position: absolute; left: 480px; top: 270px; width: 960px; height: 540px; background: #14b8a6; opacity: 1; }`,
});

describe("HTML compiler Phase 1 vertical slice", () => {
  it("lowers Gold Test 01 to valid Atomic Protocol V2", () => {
    const result = compileHtmlCss(source);
    expect(result.status).toBe("success");
    expect(result.diagnostics).toEqual([]);
    expect(result.protocol).not.toBeNull();
    expect(MotionProtocolV2Schema.parse(result.protocol)).toEqual(result.protocol);
    expect(result.protocol).toMatchObject({
      format: "motion-protocol",
      formatVersion: 2,
      composition: { width: 1920, height: 1080, fps: 30, background: "#081018" },
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
