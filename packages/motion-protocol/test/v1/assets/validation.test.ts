import { describe, expect, it } from "vitest";
import { validateLayerAssetsV1 } from "../../../src/v1/references/layer-assets";
import { AssetV1Schema } from "../../../src/v1/assets";
import type { LayerV1 } from "../../../src/v1/layers";
import type { AssetV1 } from "../../../src/v1/assets";
import { visualLayerAtoms } from "../../../src/v1/layer-atoms";

const ATOMS = visualLayerAtoms({ width: 100, height: 100 });

function imageLayer(id: string, assetId: string): LayerV1 {
  return {
    id,
    type: "image",
    parentLayerId: null,
    zIndex: 0,
    ...ATOMS,
    payload: { assetId },
  } as LayerV1;
}

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

  it("accepts external URL image asset without reference issues", () => {
    const assets: AssetV1[] = [
      AssetV1Schema.parse({
        id: "poster",
        uri: "https://cdn.example.com/poster.webp",
        assetType: "image",
        mimeType: "image/webp",
        width: 1920,
        height: 1080,
      }),
    ];
    const issues = validateLayerAssetsV1(
      [imageLayer("img", "poster")],
      assets,
      "layers",
    );
    expect(issues).toEqual([]);
  });

  it("accepts managed image asset without uri (no reference issues)", () => {
    const assets: AssetV1[] = [
      AssetV1Schema.parse({
        id: "logo",
        assetType: "image",
        mimeType: "image/png",
        width: 100,
        height: 100,
        integrity: "sha256:abc",
        sizeBytes: 2048,
        storage: {
          managed: true,
          provider: "r2",
          key: "tmp/logo.png",
          retention: "temporary",
        },
      }),
    ];
    const issues = validateLayerAssetsV1(
      [imageLayer("img", "logo")],
      assets,
      "layers",
    );
    expect(issues).toEqual([]);
  });

  it("emits asset_type_mismatch for image layer referencing video asset", () => {
    const assets: AssetV1[] = [
      AssetV1Schema.parse({
        id: "intro",
        uri: "https://cdn.example.com/intro.mp4",
        assetType: "video",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 8,
        fps: 30,
      }),
    ];
    const issues = validateLayerAssetsV1(
      [imageLayer("img", "intro")],
      assets,
      "layers",
    );
    expect(issues).toEqual([
      expect.objectContaining({
        code: "asset_type_mismatch",
        assetId: "intro",
      }),
    ]);
  });

  it("emits video_trim_invalid when trimEnd exceeds asset duration", () => {
    const assets: AssetV1[] = [
      AssetV1Schema.parse({
        id: "intro",
        uri: "https://cdn.example.com/intro.mp4",
        assetType: "video",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 8,
        fps: 30,
      }),
    ];
    const layer = {
      id: "video_1",
      type: "video",
      parentLayerId: null,
      zIndex: 0,
      ...ATOMS,
      payload: { assetId: "intro", trimEnd: 10 },
    } as LayerV1;
    const issues = validateLayerAssetsV1([layer], assets, "layers");
    expect(issues).toEqual([
      expect.objectContaining({ code: "video_trim_invalid", assetId: "intro" }),
    ]);
  });
});
