import { describe, expect, it } from "vitest";
import type { EditorCommand } from "@motionvideo/editor-core";
import { createThreeKingdomsHistoryProject } from "@/lib/editor/document/demo-projects";
import { commandsForLibraryPayload } from "@/lib/editor/library/commands";

describe("library audio placement", () => {
  it("keeps a dropped audio asset on the selected mixer track", () => {
    const project = createThreeKingdomsHistoryProject();
    const audioAsset = project.assets.find((asset) => asset.kind === "audio");
    expect(audioAsset).toBeDefined();
    if (!audioAsset) return;

    const commands = commandsForLibraryPayload(
      project,
      {
        kind: "asset",
        id: audioAsset.id,
        label: audioAsset.id,
        asset: audioAsset,
        duration: 4,
      },
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
