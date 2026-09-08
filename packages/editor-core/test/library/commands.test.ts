import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import type { EditorCommand } from "../../src";
import { commandsForLibraryPayload } from "../../src/library";

describe("library command construction", () => {
  it("keeps a dropped audio asset on the selected mixer track", () => {
    const project = MotionProtocolV2Schema.parse({
      format: "motion-protocol",
      formatVersion: 2,
      id: "library-command-test",
      composition: {
        width: 320,
        height: 180,
        fps: 30,
        background: "#000000",
        colorSpace: "srgb",
        view: {
          projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
          transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
        },
      },
      assets: [{ id: "audio-1", kind: "audio", uri: "/audio.wav", mimeType: "audio/wav", duration: 10_000 }],
      layers: [],
      audio: {
        sampleRate: 48_000,
        tracks: [{ id: "music", gainDb: 0, pan: 0, muted: false, clips: [] }],
      },
    });
    const audioAsset = project.assets[0]!;

    const commands = commandsForLibraryPayload(
      project,
      { kind: "asset", id: audioAsset.id, label: audioAsset.id, asset: audioAsset, duration: 4 },
      { track: "audio", laneId: "lane.audio.music", startTime: 2 },
    );
    const addAudio = commands.find(
      (command): command is Extract<EditorCommand, { type: "add-audio-clip" }> =>
        command.type === "add-audio-clip",
    );

    expect(addAudio).toMatchObject({
      type: "add-audio-clip",
      trackId: "music",
      clip: { timing: { start: 2000, duration: 4000 } },
    });
  });
});
