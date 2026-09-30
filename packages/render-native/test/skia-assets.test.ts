import { describe, expect, it } from "vitest";
import { resolveLocalPreviewAssetPath } from "../src/render/skia-assets";

describe("resolveLocalPreviewAssetPath", () => {
  it("maps preview URLs to public assets", () => {
    expect(resolveLocalPreviewAssetPath("/preview/image/photo-landscape.jpg", "D:/repo/apps/web/public"))
      .toBe("D:\\repo\\apps\\web\\public\\preview\\image\\photo-landscape.jpg");
    expect(resolveLocalPreviewAssetPath("/preview/audio/Music-MBB-Island-Tropical_128k.mp3", "D:/repo/apps/web/public"))
      .toBe("D:\\repo\\apps\\web\\public\\preview\\audio\\Music-MBB-Island-Tropical_128k.mp3");
  });

  it("rejects path traversal outside the configured public root", () => {
    expect(() => resolveLocalPreviewAssetPath("/preview/../.env", "D:/repo/apps/web/public"))
      .toThrow(/escapes the configured asset root/);
  });
});
