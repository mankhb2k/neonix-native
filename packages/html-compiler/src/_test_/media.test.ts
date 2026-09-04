import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

describe("HTML/CSS compiler media", () => {
  it("lowers image fit, position, rendering and registers its asset", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<img id="cover" src="/preview/image/photo-portrait.jpg">`,
      css: `#cover { position: absolute; left: 720px; top: 360px; width: 480px; height: 300px; object-fit: cover; object-position: right top; image-rendering: pixelated; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.assets).toEqual([
      { id: "cover-asset", kind: "image", uri: "/preview/image/photo-portrait.jpg", mimeType: "image/jpeg" },
    ]);
    expect(result.protocol?.layers.find((layer) => layer.id === "cover")).toMatchObject({
      type: "image",
      frame: { width: 480, height: 300 },
      payload: {
        assetId: "cover-asset",
        fit: "cover",
        preserveAspectRatio: { align: "xMaxYMin", meetOrSlice: "slice" },
        imageRendering: "pixelated",
      },
    });
  });

  it("keeps intrinsic image size for none and lowers video fitting", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="viewport"><img id="native" src="/preview/image/photo-landscape.jpg"><video id="clip" src="/preview/video/clip.mp4"></video></div>`,
      css: `#viewport { position: absolute; left: 100px; top: 100px; width: 640px; height: 360px; overflow: hidden; } #native { position: absolute; width: 640px; height: 360px; object-fit: none; object-position: center; } #clip { position: absolute; left: 700px; width: 480px; height: 270px; object-fit: contain; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "viewport")).toMatchObject({
      type: "group",
      clipPath: "html-overflow-clip-0",
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "native")).toMatchObject({
      type: "image",
      payload: { fit: "none", preserveAspectRatio: { align: "xMidYMid" } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "clip")).toMatchObject({
      type: "video",
      payload: { fit: "contain", assetId: "clip-asset" },
    });
  });
});
