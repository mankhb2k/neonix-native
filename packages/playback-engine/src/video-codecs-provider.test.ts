import { describe, expect, it } from "vitest";
import { chooseVideoBackendV2, createVideoFrameQueueV2 } from "./video-codecs-provider";

describe("video decoder policy", () => {
  it("requires both WebCodecs and demux capability", () => {
    expect(chooseVideoBackendV2({ preferWebCodecs: true, webCodecsAvailable: true, demuxAvailable: false })).toBe("html-video");
    expect(chooseVideoBackendV2({ preferWebCodecs: true, webCodecsAvailable: true, demuxAvailable: true })).toBe("webcodecs");
  });

  it("bounds frames and closes stale generations", () => {
    const closed: number[] = [];
    const queue = createVideoFrameQueueV2({ maxFrames: 2 });
    queue.reset(4);
    const frame = (timestamp: number) => ({ timestamp, close: () => closed.push(timestamp) });
    expect(queue.push(frame(0), 4)).toBe(true);
    expect(queue.push(frame(1), 4)).toBe(true);
    expect(queue.push(frame(2), 4)).toBe(true);
    expect(closed).toEqual([0]);
    expect(queue.takeAt(1.5, 4)?.timestamp).toBe(1);
    queue.reset(5);
    expect(queue.push(frame(3), 4)).toBe(false);
    expect(queue.getStats().generation).toBe(5);
  });
});
