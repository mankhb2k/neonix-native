import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

describe("HTML compiler Phase 0 contract baseline", () => {
  it("keeps the fixed composition and stable layer/asset identities", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body><div id="background"></div><img id="poster" src="/poster.png"></body>`,
      css: `
        #background { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; background: #081018; }
        #poster { position: absolute; left: 120px; top: 80px; width: 640px; height: 360px; }
      `,
    }));

    expect(result.status).toBe("success");
    expect(result.diagnostics).toEqual([]);
    expect(result.protocol?.composition).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#081018",
      colorSpace: "srgb",
    });
    expect(result.protocol?.layers.map(({ id, type, parentLayerId }) => ({ id, type, parentLayerId }))).toEqual([
      { id: "background", type: "shape", parentLayerId: null },
      { id: "poster", type: "image", parentLayerId: null },
    ]);
    expect(result.protocol?.assets?.map(({ id, kind, uri }) => ({ id, kind, uri }))).toEqual([
      { id: "poster-asset", kind: "image", uri: "/poster.png" },
    ]);
  });

  it("keeps unsupported-tag diagnostics stable", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<body><button id="cta">Click</button></body>` }));

    expect(result.status).toBe("error");
    expect(result.protocol).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "html-tag-unsupported",
    });
  });
});
