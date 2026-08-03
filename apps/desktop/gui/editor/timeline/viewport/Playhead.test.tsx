import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaybackClockStore,
  PlaybackClockContext,
} from "../../playback/playback-clock-store";
import { Playhead } from "./Playhead";

describe("Playhead scrub lifecycle", () => {
  let nextRafId = 1;
  let rafCallbacks: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    rafCallbacks = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function flushRafOnce() {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    for (const callback of callbacks) callback(performance.now());
  }

  function setup() {
    const clock = createPlaybackClockStore();
    clock.getState().reset({ duration: 30 });
    const scroll = document.createElement("div");
    Object.defineProperties(scroll, {
      scrollLeft: { value: 0, writable: true },
      scrollWidth: { value: 2_000 },
      clientWidth: { value: 400 },
    });
    scroll.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 400,
        top: 0,
        bottom: 200,
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const view = render(
      <PlaybackClockContext.Provider value={clock}>
        <Playhead
          tracksOriginX={104}
          pixelsPerSecond={100}
          scrollLeft={0}
          scrollContainerRef={{ current: scroll }}
          maxTime={30}
        />
      </PlaybackClockContext.Provider>,
    );
    const slider = screen.getByRole("slider") as HTMLDivElement;
    let captured = false;
    slider.setPointerCapture = vi.fn(() => {
      captured = true;
    });
    slider.hasPointerCapture = vi.fn(() => captured);
    slider.releasePointerCapture = vi.fn(() => {
      captured = false;
    });
    return { ...view, clock, scroll, slider };
  }

  it("ends scrubbing and stops queued edge work on pointerup", () => {
    const { clock, scroll, slider } = setup();
    fireEvent.pointerDown(slider, {
      pointerId: 1,
      button: 0,
      clientX: 390,
    });
    expect(clock.getState().mode).toBe("scrubbing");
    expect(scroll.scrollLeft).toBeGreaterThan(0);
    expect(rafCallbacks.size).toBeGreaterThan(0);

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 390 });

    expect(clock.getState().mode).toBe("idle");
    expect(rafCallbacks.size).toBe(0);
  });

  it("ends scrubbing when pointer capture is lost", () => {
    const { clock, slider } = setup();
    fireEvent.pointerDown(slider, {
      pointerId: 1,
      button: 0,
      clientX: 390,
    });

    fireEvent.lostPointerCapture(slider, { pointerId: 1 });

    expect(clock.getState().mode).toBe("idle");
    expect(rafCallbacks.size).toBe(0);
  });

  it("ends scrubbing when Playhead unmounts during a drag", () => {
    const { clock, slider, unmount } = setup();
    fireEvent.pointerDown(slider, {
      pointerId: 1,
      button: 0,
      clientX: 390,
    });

    unmount();

    expect(clock.getState().mode).toBe("idle");
    expect(rafCallbacks.size).toBe(0);
  });

  it("does not seek the same middle position again on pointerup", () => {
    const { clock, slider } = setup();
    const revisionBefore = clock.getState().seekRevision;
    fireEvent.pointerDown(slider, {
      pointerId: 1,
      button: 0,
      clientX: 200,
    });
    flushRafOnce();
    expect(clock.getState().seekRevision).toBe(revisionBefore + 1);

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 200 });

    expect(clock.getState().seekRevision).toBe(revisionBefore + 1);
  });
});
