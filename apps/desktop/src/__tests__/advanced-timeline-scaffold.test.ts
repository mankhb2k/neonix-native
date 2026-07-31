import { describe, expect, it } from "vitest";
import {
  ADVANCED_TIMELINE_BEHAVIORS,
  isBehaviorScaffolded,
} from "../../renderer/src/editor/timeline/adapters/advanced-timeline";

describe("advanced timeline scaffold (UI-6)", () => {
  it("lists planned behaviors and marks shipped adapters as scaffolded", () => {
    expect(ADVANCED_TIMELINE_BEHAVIORS.length).toBeGreaterThanOrEqual(6);
    expect(isBehaviorScaffolded("clipboard")).toBe(true);
    expect(isBehaviorScaffolded("marquee")).toBe(true);
    expect(isBehaviorScaffolded("library-dnd")).toBe(true);
  });
});
