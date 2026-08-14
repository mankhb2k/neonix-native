import { describe, expect, it } from "vitest";
import { validateLayerAssetsV1 } from "../references/layer-assets";
import type { LayerV1 } from "../layers";
import type { AssetV1 } from "../assets";

const TRANSFORM = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

describe("authoring asset validation envelope", () => {
  it("emits AssetValidationIssue with layer authoring and stable codes", () => {
    const layers = [
      {
        id: "logo",
        type: "image",
        parentLayerId: null,
        zIndex: 0,
        transform: TRANSFORM,
        payload: { assetId: "missing.png" },
      },
    ] as LayerV1[];
    const assets: AssetV1[] = [];
    const issues = validateLayerAssetsV1(layers, assets, "layers");
    expect(issues).toEqual([
      {
        layer: "authoring",
        code: "unknown_asset",
        assetId: "missing.png",
        path: "layers.logo.payload.assetId",
        message: "Unknown asset: missing.png",
      },
    ]);
  });
});
