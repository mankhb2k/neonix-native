import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "../document/demo-projects";
import { frameCount, projectDuration, previewFrameAtTime } from "./preview-controller";

describe("V2 editor preview controller", () => {
  it("derives duration and frame count from Atomic V2 timing", () => {
    const project = createV2EditorProject("shape");
    expect(projectDuration(project)).toBe(3);
    expect(frameCount(project)).toBe(90);
  });

  it("evaluates a deterministic Runtime V2 frame", () => {
    const project = createV2EditorProject("overlap");
    const frame = previewFrameAtTime(project, 1);
    expect(frame.runtimeFormat).toBe("motion-runtime");
    expect(frame.runtimeVersion).toBe(2);
    expect(frame.frame).toBe(30);
    expect(frame.commands.filter((command) => command.op === "drawShape")).toHaveLength(2);
  });
});
