import { describe, expect, it } from "vitest";
import { createV2ShapeProject } from "@motionvideo/motion-compiler/testing";
import {
  compileAtomicProtocolV2,
  validateAtomicProtocolV2,
} from "./index";

describe("AI planner V2 boundary", () => {
  it("validates and compiles a certified V2 shape document", () => {
    const project = createV2ShapeProject({ id: "ai-v2" });
    const validated = validateAtomicProtocolV2(project);
    expect(validated.valid).toBe(true);
    expect(compileAtomicProtocolV2(project).formatVersion).toBe(2);
  });

  it("rejects the retired project envelope", () => {
    const validated = validateAtomicProtocolV2({
      format: "motion-project",
      formatVersion: 1,
    });
    expect(validated.valid).toBe(false);
  });
});
