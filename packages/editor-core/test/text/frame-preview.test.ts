import { describe, expect, it } from "vitest";
import { buildTextEditFramePreview } from "../../src/text/frame-preview";

describe("text edit frame preview policy", () => {
  it("grows for explicit line breaks", () => {
    expect(buildTextEditFramePreview({
      layerId: "title",
      beforeText: "One",
      draftText: "One\nTwo",
      lineHeight: 40,
      wrapsText: false,
    })).toEqual({ layerId: "title", height: 80 });
  });

  it("uses measured wrapped lines without shrinking the explicit draft", () => {
    expect(buildTextEditFramePreview({
      layerId: "title",
      beforeText: "One",
      draftText: "One\nTwo",
      lineHeight: 40,
      wrapsText: true,
      measuredLineCount: 3,
    })).toEqual({ layerId: "title", height: 120 });
  });
});
