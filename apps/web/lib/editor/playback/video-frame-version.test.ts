import { describe, expect, it, vi } from "vitest";
import { trackVideoFrameVersion } from "./video-frame-version";

describe("trackVideoFrameVersion", () => {
  it("tracks decoded callbacks and cancels the pending callback", () => {
    const video = document.createElement("video") as HTMLVideoElement & {
      requestVideoFrameCallback: (callback: () => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    };
    let callback: (() => void) | null = null;
    const cancel = vi.fn();
    video.requestVideoFrameCallback = (next) => {
      callback = next;
      return 7;
    };
    video.cancelVideoFrameCallback = cancel;
    const onDecoded = vi.fn();
    const release = trackVideoFrameVersion(video, onDecoded);

    callback?.();
    expect(onDecoded).toHaveBeenCalledTimes(1);
    release();
    expect(cancel).toHaveBeenCalledWith(7);
    callback?.();
    expect(onDecoded).toHaveBeenCalledTimes(1);
  });

  it("falls back to timeupdate and removes the listener", () => {
    const video = document.createElement("video");
    const onDecoded = vi.fn();
    const release = trackVideoFrameVersion(video, onDecoded);
    video.dispatchEvent(new Event("timeupdate"));
    expect(onDecoded).toHaveBeenCalledTimes(1);
    release();
    video.dispatchEvent(new Event("timeupdate"));
    expect(onDecoded).toHaveBeenCalledTimes(1);
  });
});
