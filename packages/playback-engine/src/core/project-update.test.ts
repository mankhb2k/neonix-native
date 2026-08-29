import { describe, expect, it } from "vitest";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { createFakeClock } from "../clock";
import { createPlaybackEngine } from "./playback-engine";

function project(id: string): RuntimeProjectV3 {
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: id,
    visual: {
      composition: { width: 1, height: 1, fps: 30, graphId: "graph" },
      view: { worldToClipMatrix: new Float64Array(16) },
      nodes: [],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48_000, tracks: [] },
  };
}

describe("PlaybackEngine project updates", () => {
  it("replaces plans without pausing or rewinding the authoritative transport", () => {
    const clock = createFakeClock();
    const calls: string[] = [];
    const engine = createPlaybackEngine({
      clock,
      videoSink: {
        publish: () => calls.push("video"),
        pause: () => calls.push("pause"),
      },
    });

    engine.load(project("before"));
    engine.play();
    clock.advance(1_250_000);
    engine.tick();
    calls.length = 0;

    engine.updateProject(project("after"));

    expect(engine.snapshot()).toMatchObject({
      state: "playing",
      timeUs: 1_250_000,
      projectId: "after",
    });
    expect(calls).toEqual(["video"]);
  });
});
