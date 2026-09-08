import { describe, expect, it } from "vitest";
import { createFakeClock } from "../../src/clock";
import { createPlaybackEngine } from "../../src/core/playback-engine";

const project = () => ({ format: "motion-runtime" as const, runtimeVersion: 3 as const, projectId: "subscription-test", durationUs: 10_000_000, visual: { composition: { width: 1, height: 1, fps: 30, graphId: "g" }, view: { worldToClipMatrix: new Float64Array(16) }, nodes: [] }, mediaCatalog: { assets: [] }, videoTimeline: { instances: [] }, audioTimeline: { sampleRate: 48_000 as const, tracks: [] } });

describe("PlaybackEngine effective state subscription", () => {
  it("publishes state changes without requiring a UI tick", () => {
    const states: string[] = [];
    const engine = createPlaybackEngine({ clock: createFakeClock() });
    engine.subscribe((snapshot) => states.push(snapshot.state));
    engine.load(project());
    engine.play();
    engine.pause();
    expect(states).toContain("playing");
    expect(states.at(-1)).toBe("paused");
  });
});
