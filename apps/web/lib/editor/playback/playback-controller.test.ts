import { describe, expect, it } from "vitest";
import { createPlaybackController } from "./playback-controller";
import { createV2EditorProject } from "../document/demo-projects";

const project = createV2EditorProject("shape");

describe("PlaybackController", () => {
  it("owns load, seek, snapshot, and disposal lifecycle", () => {
    const snapshots: number[] = [];
    const controller = createPlaybackController({
      onSnapshot: (snapshot) => snapshots.push(snapshot.time),
      collectPerformanceMetrics: true,
    });

    controller.loadDocument(project, 0.4);
    expect(controller.getSnapshot()?.time).toBe(0.4);
    expect(controller.playing).toBe(false);

    controller.seek(0.8);
    expect(controller.getSnapshot()?.time).toBe(0.8);
    expect(snapshots).toContain(0.4);
    expect(snapshots).toContain(0.8);

    controller.dispose();
    controller.dispose();
    expect(controller.getSnapshot()).toBeNull();
    expect(controller.playing).toBe(false);
  });

  it("invalidates an async play request when pause wins the race", async () => {
    const controller = createPlaybackController();
    const playResult = controller.play();
    controller.pause();
    expect(await playResult).toBe(false);
    controller.dispose();
  });

  it("paints each evaluated frame through the imperative sink", () => {
    const events: Array<{ time: number; commandCount: number; generation: number }> = [];
    const controller = createPlaybackController();
    const release = controller.registerFrameSink(({ time, frame, generation }) => {
      events.push({ time, commandCount: frame.commands.length, generation });
    });

    controller.loadDocument(project, 0.4);
    controller.previewAt(0.8);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.time)).toEqual([0.4, 0.8]);
    expect(events.every((event) => event.commandCount > 0)).toBe(true);
    expect(events[1]!.generation).toBeGreaterThan(events[0]!.generation);

    release();
    controller.previewAt(1.2);
    expect(events).toHaveLength(2);
    controller.dispose();
  });

  it("exposes bounded engine samples and media counters for diagnostics", () => {
    const controller = createPlaybackController({
      collectPerformanceMetrics: true,
      performanceSampleCapacity: 2,
    });

    controller.loadDocument(project, 0);
    controller.seek(0.1);
    controller.seek(0.2);
    controller.seek(0.3);

    const diagnostics = controller.getDiagnostics();
    expect(diagnostics.performanceSamples).toHaveLength(2);
    expect(diagnostics.media.syncCalls).toBeGreaterThanOrEqual(3);
    controller.dispose();
  });

  it("publishes time events independently of throttled transport state", () => {
    const events: Array<{ time: number; playing: boolean }> = [];
    const controller = createPlaybackController();
    controller.registerTimeSink(({ time, playing }) => {
      events.push({ time, playing });
    });

    controller.loadDocument(project, 0.25);
    controller.previewAt(0.75);

    expect(events).toEqual([
      { time: 0, playing: false },
      { time: 0.25, playing: false },
      { time: 0.75, playing: false },
    ]);
    controller.dispose();
  });

  it("filters hidden layers before the frame sink and media sync", () => {
    const controller = createPlaybackController();
    const frames: string[] = [];
    controller.setHiddenLayerIds(["shape"]);
    controller.registerFrameSink(({ frame }) => {
      frames.push(frame.commands.map((command) => command.op).join(","));
      expect(frame.commands.some((command) => command.op === "drawShape")).toBe(false);
    });

    controller.loadDocument(project, 0.4);

    expect(frames).toHaveLength(1);
    controller.dispose();
  });

  it("keeps registrations bounded across repeated play/pause/seek cycles", async () => {
    const controller = createPlaybackController();
    const releaseFrame = controller.registerFrameSink(() => undefined);
    const releaseTime = controller.registerTimeSink(() => undefined);
    controller.loadDocument(project, 0);

    for (let cycle = 0; cycle < 30; cycle += 1) {
      void controller.play();
      controller.pause();
      controller.seek((cycle % 10) / 10);
    }

    await Promise.resolve();
    expect(controller.getResourceStats()).toEqual({
      registeredVideos: 0,
      cachedAudioBuffers: 0,
      activeAudioSources: 0,
      lateAudioSchedules: 0,
      maxAudioScheduleLateMs: 0,
    });
    releaseFrame();
    releaseTime();
    controller.dispose();
  });
});
