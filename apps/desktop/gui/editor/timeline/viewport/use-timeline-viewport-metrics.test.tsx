import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineViewportMetrics } from "./use-timeline-viewport-metrics";

describe("useTimelineViewportMetrics scroll scheduling", () => {
  let nextRafId = 1;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let requestRaf: ReturnType<typeof vi.fn>;
  let cancelRaf: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = new Map();
    requestRaf = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, callback);
      return id;
    });
    cancelRaf = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });
    vi.stubGlobal("requestAnimationFrame", requestRaf);
    vi.stubGlobal("cancelAnimationFrame", cancelRaf);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function flushRaf() {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    act(() => {
      for (const callback of callbacks) callback(performance.now());
    });
  }

  function setup() {
    const board = document.createElement("div");
    const tracks = document.createElement("div");
    Object.defineProperties(tracks, {
      scrollLeft: { value: 0, writable: true },
      scrollTop: { value: 0, writable: true },
      scrollWidth: { value: 2_000 },
      clientWidth: { value: 400 },
    });
    const boardRef = { current: board };
    const tracksScrollRef = { current: tracks };
    let renderCount = 0;
    const hook = renderHook(() => {
      renderCount += 1;
      return useTimelineViewportMetrics({
        boardRef,
        tracksScrollRef,
        resetKey: "project-1",
      });
    });
    return { ...hook, tracks, getRenderCount: () => renderCount };
  }

  it("coalesces repeated scroll samples into one RAF and publishes the latest pair", () => {
    const { result, tracks } = setup();

    act(() => {
      tracks.scrollLeft = 10;
      tracks.scrollTop = 20;
      result.current.onScroll();
      tracks.scrollLeft = 70;
      tracks.scrollTop = 90;
      result.current.onScroll();
    });

    expect(requestRaf).toHaveBeenCalledTimes(1);
    flushRaf();
    expect(result.current.scrollLeft).toBe(70);
    expect(result.current.scrollTop).toBe(90);
  });

  it("does not invoke the hook again when sampled coordinates are unchanged", () => {
    const { result, tracks, getRenderCount } = setup();
    act(() => {
      tracks.scrollLeft = 25;
      tracks.scrollTop = 35;
      result.current.onScroll();
    });
    flushRaf();
    const afterFirstPublish = getRenderCount();

    act(() => result.current.onScroll());
    flushRaf();

    expect(getRenderCount()).toBe(afterFirstPublish);
  });

  it("cancels a pending scroll frame on unmount", () => {
    const { result, tracks, unmount } = setup();
    act(() => {
      tracks.scrollLeft = 10;
      result.current.onScroll();
    });
    expect(rafCallbacks.size).toBe(1);

    unmount();

    expect(cancelRaf).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);
  });
});
