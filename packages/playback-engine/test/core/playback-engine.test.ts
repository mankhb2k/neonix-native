import { describe, expect, it } from "vitest";
import type { RuntimeProjectV3, VideoRenderPlanV3, RuntimeAudioMixPlanV3 } from "@motionvideo/motion-runtime";
import { createFakeClock } from "../../src/clock";
import { createPlaybackEngine } from "../../src/core/playback-engine";
import { createResourceDisposalGuard } from "../../src/core/operation-token";
import { decideAdaptiveBufferV3 } from "../../src/core/buffer-policy";

const project = (): RuntimeProjectV3 => ({ format: "motion-runtime", runtimeVersion: 3, projectId: "engine-test", durationUs: 10_000_000, visual: { composition: { width: 1, height: 1, fps: 30, graphId: "g" }, view: { worldToClipMatrix: new Float64Array(16) }, nodes: [] }, mediaCatalog: { assets: [] }, videoTimeline: { instances: [] }, audioTimeline: { sampleRate: 48000, tracks: [] } });

describe("PlaybackEngine pure core", () => {
  it("runs deterministic fake-clock ticks and dispatches both plan types", () => { const clock = createFakeClock(); const video: VideoRenderPlanV3[] = []; const audio: RuntimeAudioMixPlanV3[] = []; const engine = createPlaybackEngine({ clock, videoSink: { publish: (plan) => video.push(plan) }, audioSink: { publish: (plan) => audio.push(plan) } }); engine.load(project()); engine.play(); clock.advance(100_000); engine.tick(); expect(engine.snapshot()).toMatchObject({ state: "playing", timeUs: 100_000, metrics: { ticks: 1, publishedVideoPlans: 1, publishedAudioPlans: 1 } }); expect(video[0]?.timelineTimeUs).toBe(100_000); expect(audio[0]).toMatchObject({ startSample: 4800, endSample: 16800 }); });
  it("makes stale completions no-ops across rapid seek operations", () => { const engine = createPlaybackEngine({ clock: createFakeClock() }); engine.load(project()); engine.play(); const firstSeek = engine.seek(1_000_000); const secondSeek = engine.seek(2_000_000); expect(engine.isCurrent(firstSeek)).toBe(false); expect(engine.isCurrent(secondSeek)).toBe(true); expect(engine.complete(firstSeek, () => "stale")).toBeUndefined(); expect(engine.complete(secondSeek, () => "current")).toBe("current"); expect(engine.snapshot().metrics.staleOperations).toBe(1); });
  it("keeps pause/seek state deterministic and disposes sinks once", () => { const clock = createFakeClock(); let disposed = 0; const engine = createPlaybackEngine({ clock, videoSink: { publish() {}, dispose: () => { disposed += 1; } } }); engine.load(project()); engine.play(); clock.advance(500_000); engine.pause(); expect(engine.snapshot()).toMatchObject({ state: "paused", timeUs: 500_000 }); engine.seek(50_000); expect(engine.snapshot()).toMatchObject({ state: "paused", timeUs: 50_000 }); engine.dispose(); engine.dispose(); expect(disposed).toBe(1); expect(engine.snapshot().state).toBe("disposed"); });
  it("uses backend lifecycle around play, seek, and pause", () => { const calls: string[] = []; const engine = createPlaybackEngine({ clock: createFakeClock(), videoSink: { publish() { calls.push("publish"); }, start() { calls.push("start"); }, pause() { calls.push("pause"); }, flush() { calls.push("flush"); } } }); engine.load(project()); engine.play(); engine.seek(10_000); engine.pause(); expect(calls).toEqual(["start", "flush", "publish", "start", "pause"]); });
  it("fails load before any backend can consume an invalid runtime", () => { const engine = createPlaybackEngine({ clock: createFakeClock() }); const invalid = { ...project(), runtimeVersion: 2 as const }; engine.load(invalid as unknown as RuntimeProjectV3); expect(engine.snapshot()).toMatchObject({ state: "error", readiness: "failed" }); });
  it("provides bounded buffer decisions and resource disposal guards", () => { expect(decideAdaptiveBufferV3(100, 1000, 250)).toBe("underrun"); expect(decideAdaptiveBufferV3(500, 1000, 250)).toBe("fill"); expect(decideAdaptiveBufferV3(1000, 1000, 250)).toBe("hold"); const guard = createResourceDisposalGuard(); let disposed = 0; guard.register(() => { disposed += 1; }); guard.dispose(); guard.dispose(); expect(disposed).toBe(1); guard.register(() => { disposed += 1; }); expect(disposed).toBe(2); });
  it("does not make an async play completion stale merely because a render tick ran", () => {
    const engine = createPlaybackEngine({ clock: createFakeClock() });
    engine.load(project());
    const play = engine.play();
    engine.tick();
    expect(engine.isCurrent(play)).toBe(true);
    engine.pause();
    expect(engine.isCurrent(play)).toBe(false);
  });
  it("transitions to ended at the runtime duration and restarts from zero", () => {
    const clock = createFakeClock();
    const requested: Array<() => void> = [];
    const cancelled: number[] = [];
    const plans: number[] = [];
    let pauses = 0;
    const engine = createPlaybackEngine({
      clock,
      scheduler: {
        request(callback) { requested.push(callback); return requested.length - 1; },
        cancel(handle) { cancelled.push(handle); },
      },
      videoSink: {
        publish(plan) { plans.push(plan.timelineTimeUs); },
        pause() { pauses += 1; },
      },
    });
    engine.load({ ...project(), durationUs: 1_000_000 });
    engine.play();
    clock.advance(1_100_000);
    engine.tick();

    expect(engine.snapshot()).toMatchObject({ state: "ended", timeUs: 1_000_000, durationUs: 1_000_000 });
    expect(plans.at(-1)).toBeGreaterThan(0);
    expect(plans.at(-1)).toBeLessThan(1_000_000);
    expect(pauses).toBe(1);
    expect(cancelled).toEqual([0]);
    engine.tick();
    expect(engine.snapshot().state).toBe("ended");

    engine.play();
    expect(engine.snapshot()).toMatchObject({ state: "playing", timeUs: 0 });
    engine.pause();
    engine.seek(500_000);
    expect(engine.snapshot()).toMatchObject({ state: "paused", timeUs: 500_000 });
  });
  it("exposes a preparing state while an async backend start is pending", async () => {
    let resolveStart!: () => void;
    const start = new Promise<void>((resolve) => { resolveStart = resolve; });
    const engine = createPlaybackEngine({ clock: createFakeClock(), videoSink: { publish() {}, start: () => start } });
    engine.load(project());
    engine.play();
    expect(engine.snapshot().state).toBe("preparing");
    resolveStart();
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.snapshot().state).toBe("playing");
  });
});
