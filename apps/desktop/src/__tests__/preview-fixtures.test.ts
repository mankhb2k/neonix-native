import { describe, expect, it } from "vitest";
import {
  buildSyntheticClipCount,
  buildSyntheticPreviewNodes,
  PREVIEW_FIXTURE_SIZES,
  PREVIEW_FRAME_BUDGET_MS,
} from "../../renderer/src/editor/stage/preview-fixtures";

describe("preview fixtures", () => {
  it("exports Gate N7 sizes", () => {
    expect(PREVIEW_FIXTURE_SIZES).toEqual([100, 500, 2000]);
    expect(buildSyntheticClipCount(500)).toBe(500);
    expect(buildSyntheticPreviewNodes(100)).toHaveLength(100);
    expect(PREVIEW_FRAME_BUDGET_MS).toBeCloseTo(1000 / 60);
  });
});
