import { describe, expect, it } from "vitest";
import { V2_AUDIO_FIXTURES } from "@motionvideo/motion-protocol";
import type { RuntimeMediaCatalogV3 } from "@motionvideo/motion-runtime";
import {
  compileProtocol,
} from "./index";

describe("canonical compiler V3 projection", () => {
  it("derives RuntimeProjectV3 from the same canonical compiler output", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.mix.video-plus-music");
    if (!fixture) throw new Error("audio.mix.video-plus-music fixture is missing");

    const runtime = compileProtocol(fixture.project);

    expect(runtime).toMatchObject({
      format: "motion-runtime",
      runtimeVersion: 3,
      projectId: fixture.project.id,
      visual: {
        composition: expect.any(Object),
        view: expect.any(Object),
        nodes: expect.any(Array),
      },
    });
    expect(runtime.audioTimeline.tracks.flatMap((track) => track.clips)).toHaveLength(2);
  });

  it("keeps catalog durationSamples in the native 44.1 kHz source domain", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.timing");
    if (!fixture) throw new Error("audio.timing fixture is missing");

    const runtime = compileProtocol(fixture.project);
    const stream = runtime.mediaCatalog.assets[0]?.audio?.[0];

    expect(stream).toMatchObject({
      sampleRate: 44_100,
      durationSamples: Math.round(124.551837 * 44_100),
    });
  });

  it("uses probe-hydrated media metadata when a catalog is supplied", () => {
    const catalog: RuntimeMediaCatalogV3 = {
      assets: [{
        mediaId: "music-mbb-island-tropical",
        audio: [{
          streamId: "probe:music:0",
          resource: {
            resourceId: "music-derivative-v2",
            role: "audio-proxy",
            uri: "/derivatives/music.m4a",
          },
          durationSamples: 5_492_736,
          sampleRate: 44_100,
          channels: 2,
        }],
      }],
    };

    const runtime = compileProtocol(fixtureProject("audio.timing"), { mediaCatalog: catalog });
    expect(runtime.mediaCatalog).toBe(catalog);
    expect(runtime.audioTimeline.tracks[0]?.clips[0]?.source).toEqual({
      mediaId: "music-mbb-island-tropical",
      streamId: "probe:music:0",
    });
  });

  it("is deterministic and rejects a probe catalog without a required derivative", () => {
    const project = fixtureProject("audio.timing");
    expect(compileProtocol(project)).toEqual(compileProtocol(project));
    try {
      compileProtocol(project, { mediaCatalog: { assets: [] } });
      throw new Error("Expected compilation to reject the missing derivative");
    } catch (error) {
      expect(error).toMatchObject({ code: "MISSING_AUDIO_DERIVATIVE" });
    }
  });

});

function fixtureProject(id: string) {
  const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === id);
  if (!fixture) throw new Error(`${id} fixture is missing`);
  return fixture.project;
}
