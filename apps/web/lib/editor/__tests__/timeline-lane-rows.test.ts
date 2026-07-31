import { describe, expect, it } from "vitest";
import { buildTimelineLaneRows } from "../../../components/desktop/editor/timeline/Tracks/timeline-lane-rows";
import type { TimelineLane } from "@/lib/editor/timeline-clips";

import { DEFAULT_VISUAL_POLICY } from "@/lib/editor/model/timeline-types";

describe("Timeline Lane Rows Model", () => {
  it("builds ordered lane rows matching overlay, main, audio sequence", () => {
    const lanes: TimelineLane[] = [
      { id: "main", kind: "visual", role: "base", order: 0, name: "Main", policy: DEFAULT_VISUAL_POLICY },
      { id: "ov1", kind: "visual", role: "overlay", order: 1, name: "Overlay 1", policy: DEFAULT_VISUAL_POLICY },
      { id: "au1", kind: "audio", role: "audio", order: 0, name: "Audio 1" },
    ];

    const rows = buildTimelineLaneRows(lanes);
    expect(rows.map((r) => r.id)).toEqual(["ov1", "main", "au1"]);
    expect(rows[0].height).toBe(48);
    expect(rows[1].height).toBe(60);
    expect(rows[2].height).toBe(48);
  });
});
