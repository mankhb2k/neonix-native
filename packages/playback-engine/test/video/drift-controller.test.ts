import { describe, expect, it } from "vitest";
import { createDriftControllerV3 } from "../../src/video/drift-controller";

describe("VideoDriftController V3", () => {
  it("tolerates decoder jitter and only requests a hard seek for large drift", () => {
    const controller = createDriftControllerV3({ toleranceUs: 50_000, softThresholdUs: 100_000, hardThresholdUs: 250_000 });
    expect(controller.update(1_000_000, 1_020_000)).toMatchObject({ action: "none", driftUs: 20_000 });
    expect(controller.update(1_000_000, 1_080_000).action).toBe("tolerate");
    expect(controller.update(1_000_000, 1_150_000).action).toBe("soft-adjust");
    expect(controller.update(1_000_000, 1_300_000).action).toBe("hard-seek");
  });
});
