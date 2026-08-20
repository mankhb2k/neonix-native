import { describe, expect, it } from "vitest";
import { mediaLayout } from "@motionvideo/preview-renderer";

describe("preview stage rectangle foundation", () => {
  it("keeps the first media-independent primitive as a rectangle", () => {
    const layout = mediaLayout(720, 400, 720, 400, "fill", undefined);
    expect(layout).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 400,
      uv: { x: 0, y: 0, width: 1, height: 1 },
    });
  });
});
