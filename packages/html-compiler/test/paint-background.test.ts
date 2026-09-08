import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

describe("HTML/CSS compiler P2.0 background images", () => {
  it("clips solid backgrounds to background-clip and keeps the border inside the border box", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"></div>`,
      css: `#card { position: absolute; left: 100px; top: 80px; width: 960px; height: 480px; box-sizing: border-box; padding: 48px; border: 20px solid #38bdf8; background-color: #172554; background-clip: content-box; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({ type: "group", frame: { width: 960, height: 480 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::paint")).toMatchObject({
      frame: { width: 824, height: 344 },
      transform: { translate: { x: 68, y: 68 } },
      style: { fill: "#172554" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::border")).toMatchObject({
      frame: { width: 940, height: 460 },
      transform: { translate: { x: 10, y: 10 } },
      style: { fill: "#00000000", stroke: "#38bdf8", strokeWidth: 20 },
    });
  });

  it("lowers a positioned cover URL to an image atomic and clips it to the owner", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"></div>`,
      css: `body { margin: 0; } #card { position: absolute; left: 200px; top: 120px; width: 800px; height: 400px; background-color: #172554; background-image: url("/preview/image/photo-landscape.jpg"); background-position: center; background-size: cover; background-repeat: no-repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.assets).toEqual([
      { id: "card-background-0-0-asset", kind: "image", uri: "/preview/image/photo-landscape.jpg", mimeType: "image/jpeg" },
    ]);
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({ type: "group", frame: { width: 800, height: 400 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::background:0")).toMatchObject({
      type: "image",
      parentLayerId: "card",
      frame: { width: 800, height: 400 },
      payload: { fit: "cover", preserveAspectRatio: { align: "xMidYMid", meetOrSlice: "slice" } },
    });
    expect(result.protocol?.clipPaths?.[0]).toMatchObject({
      clipPathUnits: "userSpaceOnUse",
      children: [{ x: 0, y: 0, width: 800, height: 400 }],
    });
  });

  it("lowers explicit background repeat into bounded image tiles", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="tile"></div>`,
      css: `#tile { position: absolute; width: 640px; height: 360px; background-image: url(/preview/image/img-alpha.png); background-size: 160px 120px; background-repeat: repeat; }`,
    }));

    expect(result.status).toBe("success");
    const imageLayers = result.protocol?.layers.filter((layer) => layer.type === "image") ?? [];
    expect(imageLayers.length).toBeGreaterThan(12);
    expect(imageLayers.every((layer) => layer.parentLayerId === "tile")).toBe(true);
    expect(result.protocol?.clipPaths?.length).toBe(imageLayers.length);
  });

  it("keeps multiple background URL layers in authored paint order", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="layers"></div>`,
      css: `#layers { position: absolute; width: 640px; height: 360px; background-image: url(/preview/image/photo-landscape.jpg), url(/preview/image/img-alpha.png); background-position: center, right bottom; background-size: cover, 160px 120px; background-repeat: no-repeat, no-repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.assets?.map((asset) => asset.id)).toEqual([
      "layers-background-0-0-asset",
      "layers-background-1-0-asset",
    ]);
    const first = result.protocol?.layers.find((layer) => layer.id === "layers::background:0");
    const second = result.protocol?.layers.find((layer) => layer.id === "layers::background:1");
    expect(first?.order).toBeGreaterThan(second?.order ?? -1);
  });
});
