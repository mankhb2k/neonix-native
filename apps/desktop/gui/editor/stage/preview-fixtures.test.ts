import { describe, expect, it } from "vitest";
import {
  buildStagePaintFixture,
  buildSyntheticClipCount,
  buildSyntheticPreviewNodes,
  PREVIEW_FIXTURE_SIZES,
  PREVIEW_FRAME_BUDGET_MS,
} from "./preview-fixtures";

describe("preview fixtures", () => {
  it("exports Gate N7 sizes", () => {
    expect(PREVIEW_FIXTURE_SIZES).toEqual([100, 500, 2000]);
    expect(buildSyntheticClipCount(500)).toBe(500);
    expect(buildSyntheticPreviewNodes(100)).toHaveLength(100);
    expect(PREVIEW_FRAME_BUDGET_MS).toBeCloseTo(1000 / 60);
  });

  it("builds a parseable stage paint fixture", () => {
    const fixture = buildStagePaintFixture(100);
    expect(fixture.project.scenes[0]?.nodes).toHaveLength(100);
    expect(fixture.clips).toHaveLength(1);
    expect(fixture.lanes).toHaveLength(1);
  });
});
