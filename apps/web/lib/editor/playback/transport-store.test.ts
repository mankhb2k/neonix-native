import { describe, expect, it } from "vitest";
import { createTransportStore } from "./transport-store";
import type { PlaybackV2Snapshot } from "@motionvideo/playback-engine-next";

function snapshot(overrides: Partial<PlaybackV2Snapshot> = {}): PlaybackV2Snapshot {
  return {
    time: 0,
    frame: null,
    playing: true,
    audioPlan: null,
    mediaCommands: [],
    generation: 1,
    activeVisualMediaIds: [],
    activeAudioInputIds: [],
    performance: {
      tickIntervalMs: null,
      evaluateMs: 0,
      audioPlanMs: 0,
      consumerMs: 0,
      mediaSyncMs: 0,
      renderMs: 0,
      longFrameCount: 0,
      estimatedDroppedFrames: 0,
      playToFirstFrameMs: null,
    },
    ...overrides,
  };
}

describe("TransportStore", () => {
  it("throttles running time while publishing transitions immediately", () => {
    const store = createTransportStore(20);
    const first = snapshot({ time: 0, playing: true });

    expect(store.publishSnapshot(first, "running", 0, 10)).toBe(true);
    expect(store.publishSnapshot(snapshot({ time: 0.01 }), "running", 20, 10)).toBe(false);
    expect(store.publishSnapshot(snapshot({ time: 0.06 }), "running", 50, 10)).toBe(true);
    expect(store.getState().performance?.tickIntervalMs).toBeNull();
    expect(store.publishSnapshot(snapshot({ time: 0.07, playing: false }), "suspended", 55, 10)).toBe(true);
    expect(store.getState()).toMatchObject({
      currentTime: 0.07,
      playing: false,
      audioState: "suspended",
      duration: 10,
    });
  });

  it("publishes a final running sample at the timeline end", () => {
    const store = createTransportStore(20);
    expect(store.publishSnapshot(snapshot({ time: 0, playing: true }), "running", 0, 1)).toBe(true);
    expect(store.publishSnapshot(snapshot({ time: 1, playing: true }), "running", 10, 1)).toBe(true);
    expect(store.getState().currentTime).toBe(1);
  });
});
