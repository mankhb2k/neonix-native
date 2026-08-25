import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { projectLayersToTimeline } from "@motionvideo/editor-core/timeline";
import { createThreeKingdomsHistoryProject } from "./demo-projects";
import { projectDuration } from "../preview/preview-controller";

describe("Three Kingdoms Protocol V2 editor fixture", () => {
  it("is a valid one-minute Protocol V2 document", () => {
    const project = createThreeKingdomsHistoryProject();

    expect(MotionProtocolV2Schema.safeParse(project).success).toBe(true);
    expect(projectDuration(project)).toBe(60);
    expect(project.layers.find((layer) => layer.order === 0)?.id).toBe(
      "main-lane",
    );
  });

  it("projects AE-style visual rows, main order 0, then audio", () => {
    const projection = projectLayersToTimeline(
      createThreeKingdomsHistoryProject(),
    );
    const mainIndex = projection.lanes.findIndex(
      (lane) => lane.kind === "visual" && lane.role === "base",
    );
    const firstAudioIndex = projection.lanes.findIndex(
      (lane) => lane.kind === "audio",
    );

    expect(projection.lanes[mainIndex]).toMatchObject({
      id: "lane.main",
      order: 0,
    });
    expect(firstAudioIndex).toBeGreaterThan(mainIndex);
    expect(
      projection.lanes
        .slice(0, mainIndex)
        .every((lane) => lane.kind === "visual" && lane.order > 0),
    ).toBe(true);
    expect(projection.duration).toBe(60);
  });
});
