import { describe, expect, it } from "vitest";
import {
  appendAssetsToDocumentJson,
  listEnvelopeAssets,
  toDocumentAsset,
  updateAssetUriInDocumentJson,
} from "../../renderer/src/editor/assets/document-assets";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import { parseMotionProject } from "@motionvideo/motion-schema";
import { parseDesktopProjectFile } from "../shared/project-file/envelope";

describe("document-assets merge", () => {
  it("appends imported assets that parse as MotionProject", () => {
    const blank = buildBlankDesktopProject({
      createId: (p) => `${p}_doc`,
    });
    const next = appendAssetsToDocumentJson(blank.documentJson, [
      {
        id: "asset_1",
        uri: "assets/logo.png",
        assetType: "image",
        mimeType: "image/png",
      },
    ]);
    const assets = listEnvelopeAssets(next);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.uri).toBe("assets/logo.png");

    const envelope = parseDesktopProjectFile(next);
    expect(() => parseMotionProject(envelope.project)).not.toThrow();
  });

  it("updates uri on relink", () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_r` });
    let json = appendAssetsToDocumentJson(blank.documentJson, [
      {
        id: "asset_1",
        uri: "assets/old.png",
        assetType: "image",
        mimeType: "image/png",
      },
    ]);
    json = updateAssetUriInDocumentJson(json, "asset_1", {
      uri: "assets/new.jpg",
      assetType: "image",
      mimeType: "image/jpeg",
    });
    expect(listEnvelopeAssets(json)[0]!.uri).toBe("assets/new.jpg");
  });

  it("keeps prior width/height/duration when probe omits them", () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_m` });
    let json = appendAssetsToDocumentJson(blank.documentJson, [
      {
        id: "asset_1",
        uri: "assets/old.mp4",
        assetType: "video",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 3.5,
      },
    ]);
    json = updateAssetUriInDocumentJson(json, "asset_1", {
      uri: "assets/relinked.mp4",
      assetType: "video",
      mimeType: "video/mp4",
    });
    const asset = listEnvelopeAssets(json)[0]!;
    expect(asset.uri).toBe("assets/relinked.mp4");
    expect(asset.width).toBe(1920);
    expect(asset.height).toBe(1080);
    expect(asset.duration).toBe(3.5);
  });

  it("applies probed metadata when provided on relink", () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_p` });
    let json = appendAssetsToDocumentJson(blank.documentJson, [
      {
        id: "asset_1",
        uri: "assets/old.mp4",
        assetType: "video",
        mimeType: "video/mp4",
        width: 100,
        height: 100,
        duration: 1,
      },
    ]);
    json = updateAssetUriInDocumentJson(json, "asset_1", {
      uri: "assets/new.mp4",
      assetType: "video",
      mimeType: "video/mp4",
      width: 800,
      height: 600,
      duration: 2,
    });
    const asset = listEnvelopeAssets(json)[0]!;
    expect(asset.width).toBe(800);
    expect(asset.height).toBe(600);
    expect(asset.duration).toBe(2);
  });

  it("builds video placeholder fields", () => {
    const row = toDocumentAsset({
      id: "asset_v",
      uri: "assets/clip.mp4",
      assetType: "video",
      mimeType: "video/mp4",
    });
    expect(row.hasAudio).toBe(false);
    expect(row.duration).toBe(1);
  });
});
