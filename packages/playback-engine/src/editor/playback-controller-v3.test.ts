import { describe, expect, it } from "vitest";
import { createPlaybackControllerV3 } from "./playback-controller-v3";
import { createFakeClock } from "../clock";

const project = (id: string) => ({ format: "motion-runtime" as const, runtimeVersion: 3 as const, projectId: id, visual: { composition: { width: 1, height: 1, fps: 30, graphId: "g" }, view: { worldToClipMatrix: new Float64Array(16) }, nodes: [] }, mediaCatalog: { assets: [] }, videoTimeline: { instances: [] }, audioTimeline: { sampleRate: 48000 as const, tracks: [] } });

describe("PlaybackController V3", () => {
  it("owns a stable snapshot boundary and latest-wins scrub resume", () => {
    const snapshots: string[] = [];
    const controller = createPlaybackControllerV3({ clock: createFakeClock(), onSnapshot: (snapshot) => snapshots.push(snapshot.state) });
    controller.load(project("p")); controller.play(); controller.beginScrub(); controller.updateScrub(200_000); controller.endScrub();
    expect(controller.getSnapshot()).toMatchObject({ state: "playing", timeUs: 200_000, projectId: "p" });
    expect(snapshots).toContain("playing");
    controller.dispose(); controller.dispose();
  });

  it("supports sink callbacks", () => {
    const plans: number[] = [];
    const controller = createPlaybackControllerV3({ onVideoPlan: (plan) => plans.push(plan.timelineTimeUs), clock: createFakeClock() });
    controller.load(project("p")); controller.play(); controller.tick();
    expect(plans).toEqual([0]);
    controller.dispose();
  });
});
