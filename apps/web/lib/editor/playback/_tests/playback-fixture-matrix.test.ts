import { describe, expect, it } from "vitest";
import { compileProtocol } from "@motionvideo/motion-compiler";
import {
  evaluateRuntimeProjectV3,
  frameIndexAtTime,
  type RuntimeAudioMixPlanV3,
  type RuntimeFrameV3,
  type VideoRenderPlanV3,
} from "@motionvideo/motion-runtime";
import { createFakeClock, createPlaybackEngine } from "@motionvideo/playback-engine";
import { previewLabCaseById } from "@/lib/docs/preview-lab";

type PlaybackFixtureExpectation = {
  id: string;
  time: number;
  videoInstances?: number;
  videoMediaTimesUs?: number[];
  videoFramePolicies?: Array<"floor" | "round" | "ceil">;
  audioInputs?: number;
  audio?: (plan: RuntimeAudioMixPlanV3) => void;
  frameCommand?: string;
};

const FIXTURES: readonly PlaybackFixtureExpectation[] = [
  { id: "animation.timing-stagger", time: 0.4, frameCommand: "drawPath" },
  { id: "video.frame-seek", time: 1.25, videoInstances: 1, videoMediaTimesUs: [1_250_000], videoFramePolicies: ["floor"] },
  { id: "video.trim", time: 1, videoInstances: 1, videoMediaTimesUs: [13_000_000], videoFramePolicies: ["floor"] },
  { id: "video.frame-policy", time: 1, videoInstances: 1, videoMediaTimesUs: [25_000_000], videoFramePolicies: ["ceil"] },
  { id: "video.multi-instance", time: 1, videoInstances: 2, videoMediaTimesUs: [5_000_000, 37_000_000], videoFramePolicies: ["floor", "round"] },
  { id: "video.linked-audio", time: 1, videoInstances: 1, videoMediaTimesUs: [1_000_000], videoFramePolicies: ["floor"], audioInputs: 1 },
  { id: "audio.mix.video-plus-music", time: 4, audioInputs: 2 },
  { id: "audio.track.mute", time: 1, audioInputs: 1, audio: (plan) => expect(plan.inputs[0]?.muted).toBe(true) },
  { id: "audio.gain", time: 5, audioInputs: 1, audio: (plan) => expect(plan.inputs[0]?.gainLinear).toBeCloseTo(10 ** (-12 / 20), 8) },
  { id: "audio.pan", time: 5, audioInputs: 1, audio: (plan) => expect(plan.inputs[0]?.pan).toBe(1) },
  { id: "audio.fade", time: 0.5, audioInputs: 1, audio: (plan) => expect(plan.inputs[0]?.segments[0]?.gainEnvelope.fadeIn).toMatchObject({ curve: "linear" }) },
  { id: "primitive.shape.rectangle", time: 0.5, frameCommand: "drawPath" },
  { id: "text.single-line.alignment", time: 0.5, frameCommand: "drawPath" },
];

function linkedVideoAudioProject() {
  const source = previewLabCaseById("video.frame-seek").project;
  return {
    ...source,
    id: "video.linked-audio",
    assets: source.assets.map((asset) => asset.kind === "video"
      ? {
          ...asset,
          audio: {
            uri: "/preview/audio/video-audio.m4a",
            mimeType: "audio/mp4",
            duration: asset.duration,
            sampleRate: 48_000,
            channels: 2,
          },
        }
      : asset),
    layers: source.layers.map((layer) => layer.type === "video"
      ? {
          ...layer,
          payload: {
            ...layer.payload,
            audio: { enabled: true, gainDb: -3, pan: 0 },
          },
        }
      : layer),
  };
}

describe("editor playback fixture matrix", () => {
  it.each(FIXTURES)("plays the $id semantic fixture through Runtime V3", (fixture) => {
    const source = fixture.id === "video.linked-audio"
      ? { id: fixture.id, project: linkedVideoAudioProject() }
      : previewLabCaseById(fixture.id);
    expect(source.id).toBe(fixture.id);

    const runtime = compileProtocol(source.project);
    const clock = createFakeClock();
    const videoPlans: VideoRenderPlanV3[] = [];
    const audioPlans: RuntimeAudioMixPlanV3[] = [];
    const frames: RuntimeFrameV3[] = [];
    const engine = createPlaybackEngine({
      clock,
      videoSink: { publish: (plan) => videoPlans.push(plan) },
      audioSink: { publish: (plan) => audioPlans.push(plan) },
    });

    engine.load(runtime);
    const generationBeforeSeek = engine.snapshot().generation;
    engine.seek(fixture.time * 1_000_000);
    const afterSeek = engine.snapshot();
    expect(afterSeek.timeUs).toBe(Math.round(fixture.time * 1_000_000));
    expect(afterSeek.generation).toBeGreaterThan(generationBeforeSeek);

    const frame = evaluateRuntimeProjectV3(
      runtime,
      frameIndexAtTime(fixture.time, runtime.visual.composition.fps),
      { time: fixture.time },
    );
    frames.push(frame);
    expect(frames[0]).toMatchObject({ runtimeFormat: "motion-runtime", runtimeVersion: 3 });
    expect(frame.commands[0]?.op).toBe("beginFrame");
    expect(frame.commands.at(-1)?.op).toBe("endFrame");
    if (fixture.frameCommand) expect(frame.commands.some((command) => command.op === fixture.frameCommand)).toBe(true);

    const videoPlan = videoPlans.at(-1);
    if (fixture.videoInstances !== undefined) {
      expect(videoPlan?.instances).toHaveLength(fixture.videoInstances);
      expect(videoPlan?.instances.map((instance) => instance.mediaTimeUs)).toEqual(fixture.videoMediaTimesUs);
      expect(videoPlan?.instances.map((instance) => instance.framePolicy)).toEqual(fixture.videoFramePolicies);
    }

    const audioPlan = audioPlans.at(-1);
    if (fixture.audioInputs !== undefined) {
      expect(audioPlan?.inputs).toHaveLength(fixture.audioInputs);
      fixture.audio?.(audioPlan!);
    }
    if (fixture.id === "video.linked-audio") {
      expect(runtime.audioTimeline.tracks[0]?.clips[0]?.origin).toMatchObject({ kind: "video" });
    }

    engine.play();
    clock.advance(runtime.durationUs + 1_000);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ state: "ended", timeUs: runtime.durationUs, durationUs: runtime.durationUs });
    engine.dispose();
  });
});
