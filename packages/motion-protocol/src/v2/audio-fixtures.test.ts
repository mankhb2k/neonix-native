import { describe, expect, it } from "vitest";
import { isV2AtomCertified } from "./capabilities";
import { V2_AUDIO_CAPABILITY_LEDGER } from "./audio-capabilities";
import { V2_AUDIO_FIXTURES } from "./audio-fixtures";
import { MotionProtocolV2Schema } from "./project";

describe("Protocol V2 audio fixture catalog", () => {
  it("has one parseable fixture for every ledger capability", () => {
    const fixtureIds = new Set(V2_AUDIO_FIXTURES.map((fixture) => fixture.id));
    expect(V2_AUDIO_FIXTURES).toHaveLength(V2_AUDIO_CAPABILITY_LEDGER.length);

    for (const entry of V2_AUDIO_CAPABILITY_LEDGER) {
      expect(fixtureIds.has(entry.fixtureId)).toBe(true);
      const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === entry.fixtureId);
      expect(fixture?.capability).toBe(entry.id);
      expect(entry.status).toBe("runtime-ready");
      expect(isV2AtomCertified(entry.id)).toBe(false);
      expect(MotionProtocolV2Schema.parse(fixture?.project)).toEqual(fixture?.project);
    }
  });

  it("uses the local MP3 asset and keeps audio separate from visual layers", () => {
    for (const fixture of V2_AUDIO_FIXTURES.filter((item) => item.id !== "audio.video-source")) {
      expect(fixture.project.layers).toEqual([]);
      expect(fixture.project.audio.sampleRate).toBe(48000);
      expect(fixture.project.assets[0]).toMatchObject({ kind: "audio", uri: "/api/docs/audio", mimeType: "audio/mpeg" });
    }
  });

  it("requires an explicit clip when a video asset contributes audio", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.video-source");
    expect(fixture?.project.assets[0]).toMatchObject({ kind: "video" });
    expect(fixture?.project.audio.tracks[0]?.clips[0]?.assetId).toBe("example-video-audio-source");
  });
});
