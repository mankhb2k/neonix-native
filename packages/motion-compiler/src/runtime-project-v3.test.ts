import { describe, expect, it } from "vitest";
import { V2_AUDIO_FIXTURES } from "@motionvideo/motion-protocol";
import {
  compileProtocol,
  compileProtocolToRuntimeV3,
  compileProtocolV2,
} from "./index";

describe("canonical compiler V3 projection", () => {
  it("derives RuntimeProjectV3 from the same canonical compiler output", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.mix.video-plus-music");
    if (!fixture) throw new Error("audio.mix.video-plus-music fixture is missing");

    const visual = compileProtocol(fixture.project);
    const runtime = compileProtocolToRuntimeV3(fixture.project);

    expect(runtime).toMatchObject({
      format: "motion-runtime",
      runtimeVersion: 3,
      projectId: fixture.project.id,
      visual: {
        composition: visual.composition,
        view: visual.view,
        nodes: visual.nodes,
      },
    });
    expect(runtime.audioTimeline.tracks.flatMap((track) => track.clips)).toHaveLength(2);
  });

  it("keeps the old V2 function as an identity compatibility alias", () => {
    expect(compileProtocolV2).toBe(compileProtocol);
  });

  it("keeps catalog durationSamples in the native 44.1 kHz source domain", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.timing");
    if (!fixture) throw new Error("audio.timing fixture is missing");

    const runtime = compileProtocolToRuntimeV3(fixture.project);
    const stream = runtime.mediaCatalog.assets[0]?.audio?.[0];

    expect(stream).toMatchObject({
      sampleRate: 44_100,
      durationSamples: Math.round(124.551837 * 44_100),
    });
  });
});
