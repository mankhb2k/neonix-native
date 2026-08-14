import { describe, expect, it } from "vitest";
import { validateLayerAssetsV1 } from "../../../src/v1/references/layer-assets";
import type { LayerV1 } from "../../../src/v1/layers";
import type { AssetV1 } from "../../../src/v1/assets";
import { visualLayerAtoms } from "../../../src/v1/layer-atoms";

const ATOMS = visualLayerAtoms({ width: 100, height: 100 });

describe("authoring asset validation envelope", () => {
  it("emits AssetValidationIssue with layer authoring and stable codes", () => {
    const layers = [
      {
        id: "logo",
        type: "image",
        parentLayerId: null,
        zIndex: 0,
        ...ATOMS,
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
