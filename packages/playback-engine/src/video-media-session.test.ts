import { describe, expect, it } from "vitest";
import { createVideoMediaSession } from "./video-media-session";

function fakeVideo(initialTime = 0, initiallyPaused = true) {
  let currentTime = initialTime;
  let paused = initiallyPaused;
  let resolvePlay!: () => void;
  const listeners = new Map<string, Set<() => void>>();
  const playPromise = new Promise<void>((resolve) => { resolvePlay = resolve; });
  const element = {
    muted: false,
    seeking: false,
    get currentTime() { return currentTime; },
    set currentTime(value: number) { currentTime = value; },
    get paused() { return paused; },
    play() { return playPromise; },
    pause() { paused = true; },
    addEventListener(type: string, listener: () => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener); listeners.set(type, set);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) { for (const listener of listeners.get(type) ?? []) listener(); },
  } as unknown as HTMLVideoElement & { emit(type: string): void };
  return { element, resolvePlay: () => { paused = false; resolvePlay(); } };
}

const command = (mediaTime: number) => ({
  op: "drawVideo" as const,
  assetId: "video",
  uri: "/video.mp4",
  mediaTime,
});

describe("VideoMediaSession", () => {
  it("seeks paused media and reports decoded frame readiness", () => {
    const video = fakeVideo();
    let frames = 0;
    const session = createVideoMediaSession();
    session.register("video", video.element, () => { frames += 1; });
    session.sync([command(1.25)], { time: 1.25, playing: false, generation: 1 });
    video.element.emit("seeked");
    expect(video.element.currentTime).toBe(1.25);
    expect(frames).toBe(1);
    expect(session.getStats().seekRequests).toBe(1);
    session.dispose();
  });

  it("invalidates a pending play after pauseAll", async () => {
    const video = fakeVideo();
    const session = createVideoMediaSession();
    session.register("video", video.element);
    session.sync([command(0)], { time: 0, playing: true, generation: 1 });
    session.pauseAll();
    video.resolvePlay();
    await Promise.resolve();
    expect(session.getStats().playRequests).toBe(1);
    expect(session.getStats().playRejections).toBe(0);
    session.dispose();
  });

  it("replaces stale DOM elements when assets reload", () => {
    const first = fakeVideo();
    const second = fakeVideo();
    const session = createVideoMediaSession();
    session.ensure("video", first.element);
    session.ensure("video", second.element);
    expect(session.get("video")).toBe(second.element);
    session.dispose();
  });
});
