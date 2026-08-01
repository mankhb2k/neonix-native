import { describe, expect, it } from "vitest";
import {
  clipIdsInMarquee,
  normalizeMarquee,
} from "../../renderer/src/editor/timeline/marquee-geometry";

describe("marquee-geometry", () => {
  it("normalizes drag corners", () => {
    expect(normalizeMarquee({ x: 10, y: 20 }, { x: 2, y: 5 })).toEqual({
      left: 2,
      top: 5,
      right: 10,
      bottom: 20,
    });
  });

  it("selects intersecting clips", () => {
    const ids = clipIdsInMarquee(
      { left: 0, top: 0, right: 50, bottom: 40 },
      [
        { id: "a", left: 10, top: 10, right: 30, bottom: 30 },
        { id: "b", left: 80, top: 10, right: 100, bottom: 30 },
      ],
    );
    expect(ids).toEqual(["a"]);
  });
});
