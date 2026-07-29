import { describe, expect, it } from "vitest";
import { timelineCanvasDuration } from "@/components/desktop/editor/timeline/timeline-scale";

describe("SCALE-01 zoom canvas continuity", () => {
  it("does not jump abruptly across zoom 24 → 25 → 26", () => {
    const content = 10;
    const pps = 40;
    const view = 800;
    const d24 = timelineCanvasDuration(content, pps, view, 24);
    const d25 = timelineCanvasDuration(content, pps, view, 25);
    const d26 = timelineCanvasDuration(content, pps, view, 26);
    // Chênh lệch giữa bước zoom liền kề phải nhỏ hơn bước 24→26 (liên tục).
    expect(Math.abs(d25 - d24)).toBeLessThanOrEqual(Math.abs(d26 - d24) + 1e-6);
    expect(Math.abs(d26 - d25)).toBeLessThanOrEqual(Math.abs(d26 - d24) + 1e-6);
  });
});
