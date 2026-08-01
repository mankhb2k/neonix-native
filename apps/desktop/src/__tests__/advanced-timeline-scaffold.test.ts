import { describe, expect, it } from "vitest";
import {
  ADVANCED_TIMELINE_BEHAVIORS,
  BEHAVIOR_SCAFFOLD_STATUS,
  getBehaviorScaffoldStatus,
  isBehaviorScaffolded,
} from "../../renderer/src/editor/timeline/adapters/advanced-timeline";

describe("advanced timeline scaffold (UI-6)", () => {
  it("lists planned behaviors with an honest partial/done map", () => {
    expect(ADVANCED_TIMELINE_BEHAVIORS.length).toBeGreaterThanOrEqual(6);
    for (const behavior of ADVANCED_TIMELINE_BEHAVIORS) {
      expect(BEHAVIOR_SCAFFOLD_STATUS[behavior]).toMatch(/^(none|partial|done)$/);
      expect(isBehaviorScaffolded(behavior)).toBe(
        BEHAVIOR_SCAFFOLD_STATUS[behavior] !== "none",
      );
    }
    expect(getBehaviorScaffoldStatus("clipboard")).toBe("done");
    expect(getBehaviorScaffoldStatus("marquee")).toBe("done");
    expect(getBehaviorScaffoldStatus("library-dnd")).toBe("partial");
    expect(getBehaviorScaffoldStatus("lane-reorder")).toBe("partial");
  });
});
