import { describe, expect, it } from "vitest";
import {
  ADVANCED_TIMELINE_BEHAVIORS,
  isBehaviorScaffolded,
} from "../../renderer/src/editor/timeline/adapters/advanced-timeline";

describe("advanced timeline scaffold (UI-6)", () => {
  it("lists planned behaviors and marks clipboard as scaffolded", () => {
    expect(ADVANCED_TIMELINE_BEHAVIORS.length).toBeGreaterThanOrEqual(7);
    expect(isBehaviorScaffolded("clipboard")).toBe(true);
    expect(isBehaviorScaffolded("marquee")).toBe(false);
  });
});
