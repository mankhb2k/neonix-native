import { describe, expect, it } from "vitest";
import {
  createDOMMediaControllerV2,
  type PlaybackMediaCommandV2,
} from "./media-controller-v2";

function command(mediaTime: number): PlaybackMediaCommandV2 {
  return {
    op: "drawVideo",
    assetId: "video-1",
    uri: "/video.mp4",
    mediaTime,
  } as PlaybackMediaCommandV2;
}

function fakeVideo(initialTime = 0, initiallyPaused = false) {
  let currentTime = initialTime;
  let paused = initiallyPaused;
  let playCalls = 0;
  let pauseCalls = 0;
  let resolvePlay: (() => void) | null = null;
  const playPromise = new Promise<void>((resolve) => {
    resolvePlay = resolve;
  });
  const element = {
    muted: false,
    seeking: false,
    get currentTime() {
      return currentTime;
    },
    set currentTime(value: number) {
      currentTime = value;
    },
    get paused() {
      return paused;
    },
    play() {
      playCalls += 1;
      return playPromise;
    },
    pause() {
      pauseCalls += 1;
      paused = true;
    },
  } as unknown as HTMLVideoElement;
  return {
    element,
    get currentTime() {
      return currentTime;
    },
    get playCalls() {
      return playCalls;
    },
    get pauseCalls() {
      return pauseCalls;
    },
    resolvePlay() {
      paused = false;
      resolvePlay?.();
    },
  };
}

describe("DOM media controller V2", () => {
  it("does not seek a playing video for normal decoder drift", () => {
    const video = fakeVideo(1, false);
    const controller = createDOMMediaControllerV2({
      resolveVideo: () => video.element,
    });

    controller.sync([command(1.1)], { time: 1.1, playing: true, generation: 1 });

    expect(video.currentTime).toBe(1);
    expect(video.playCalls).toBe(0);
    controller.dispose();
  });

  it("corrects large playing drift and deduplicates pending play requests", () => {
    const video = fakeVideo(0, true);
    const controller = createDOMMediaControllerV2({
      resolveVideo: () => video.element,
    });

    controller.sync([command(1)], { time: 1, playing: true, generation: 1 });
    controller.sync([command(1.02)], { time: 1.02, playing: true, generation: 1 });

    expect(video.currentTime).toBe(1);
    expect(video.playCalls).toBe(1);
    video.resolvePlay();
    controller.dispose();
  });

  it("seeks precisely while paused", () => {
    const video = fakeVideo(0, false);
    const controller = createDOMMediaControllerV2({
      resolveVideo: () => video.element,
    });

    controller.sync([command(1.25)], { time: 1.25, playing: false, generation: 1 });

    expect(video.currentTime).toBe(1.25);
    expect(video.pauseCalls).toBe(1);
    controller.dispose();
  });

  it("invalidates a pending play when the media lifecycle is paused", async () => {
    const video = fakeVideo(0, true);
    const controller = createDOMMediaControllerV2({
      resolveVideo: () => video.element,
    });

    controller.sync([command(0)], { time: 0, playing: true, generation: 1 });
    controller.pauseAll();
    video.resolvePlay();
    await Promise.resolve();

    expect(video.pauseCalls).toBeGreaterThanOrEqual(2);
    expect(controller.getStats?.()).toEqual(expect.objectContaining({
      playRequests: 1,
    }));
    controller.dispose();
  });

  it("ignores a sync from an older generation", () => {
    const video = fakeVideo(0, false);
    const controller = createDOMMediaControllerV2({
      resolveVideo: () => video.element,
    });

    controller.sync([command(2)], { time: 2, playing: false, generation: 2 });
    controller.sync([command(1)], { time: 1, playing: false, generation: 1 });

    expect(video.currentTime).toBe(2);
    expect(controller.getStats?.().syncCalls).toBe(2);
    controller.dispose();
  });
});
