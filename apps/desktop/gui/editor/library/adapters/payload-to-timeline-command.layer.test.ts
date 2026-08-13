import { describe, expect, it } from "vitest";
import { payloadToTimelineCommand } from "./payload-to-timeline-command";
import type { LibraryPayload } from "../model/library-payload";

describe("payloadToTimelineCommand layer mode", () => {
  it("maps visual payloads to add-scene-node when layerSceneId is set", () => {
    const payload: LibraryPayload = {
      kind: "text",
      id: "t1",
      label: "Title",
      text: "Hi",
      duration: 2,
    };
    const { command, label } = payloadToTimelineCommand(payload, {
      track: "overlay",
      startTime: 3,
      layerSceneId: "sc1",
      layerContainerStart: 2,
      layerContainerDuration: 5,
      insertOrder: 2,
    });
    expect(label).toContain("layer");
    expect(command).toMatchObject({
      type: "add-scene-node",
      sceneId: "sc1",
      timing: { start: 1, duration: 4 },
      zIndex: 2,
    });
  });

  it("converts layer group drop time to parent-relative node timing", () => {
    const payload: LibraryPayload = {
      kind: "text",
      id: "t2",
      label: "Child",
      text: "Hi",
      duration: 2,
    };
    const { command } = payloadToTimelineCommand(payload, {
      track: "overlay",
      startTime: 8,
      layerSceneId: "sc1",
      layerContainerStart: 2,
      layerContainerDuration: 10,
      layerParentId: "group.char",
      layerParentSceneStart: 5,
      layerParentDuration: 4,
      insertOrder: 3,
    });

    expect(command).toMatchObject({
      type: "add-scene-node",
      sceneId: "sc1",
      parentLayerId: "group.char",
      timing: { start: 1, duration: 3 },
      zIndex: 3,
    });
  });

  it("rejects audio as a scene layer", () => {
    const payload: LibraryPayload = {
      kind: "audio",
      id: "a1",
      label: "SFX",
      assetId: "asset.a",
      duration: 1,
    };
    expect(() =>
      payloadToTimelineCommand(payload, {
        layerSceneId: "sc1",
        layerContainerStart: 0,
        layerContainerDuration: 5,
      }),
    ).toThrow(/audio/);
  });
});
