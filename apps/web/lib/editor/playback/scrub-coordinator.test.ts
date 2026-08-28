import { describe, expect, it } from "vitest";
import { createScrubCoordinator, type ScrubFlushReason } from "./scrub-coordinator";

function createHarness(options: {
  onEdgeFrame?: (clientX: number) => boolean;
} = {}) {
  const callbacks: Array<() => void> = [];
  const cancelled: number[] = [];
  const flushes: Array<{ x: number; reason: ScrubFlushReason }> = [];
  const coordinator = createScrubCoordinator({
    requestFrame(callback) {
      callbacks.push(callback);
      return callbacks.length - 1;
    },
    cancelFrame(handle) {
      cancelled.push(handle);
    },
    onFlush(clientX, reason) {
      flushes.push({ x: clientX, reason });
    },
    onEdgeFrame: options.onEdgeFrame,
  });
  return { coordinator, callbacks, cancelled, flushes };
}

describe("ScrubCoordinator", () => {
  it("coalesces many pointer moves into the latest value per RAF", () => {
    const harness = createHarness();
    harness.coordinator.begin(10);
    harness.coordinator.move(20);
    harness.coordinator.move(30);
    harness.coordinator.move(40);

    expect(harness.flushes).toEqual([{ x: 10, reason: "begin" }]);
    expect(harness.callbacks).toHaveLength(1);
    harness.callbacks.shift()!();

    expect(harness.flushes).toEqual([
      { x: 10, reason: "begin" },
      { x: 40, reason: "frame" },
    ]);
  });

  it("flushes exact pointer-up position and cancels the pending RAF", () => {
    const harness = createHarness();
    harness.coordinator.begin(10);
    harness.coordinator.move(25);
    harness.coordinator.end();

    expect(harness.flushes).toEqual([
      { x: 10, reason: "begin" },
      { x: 25, reason: "end" },
    ]);
    expect(harness.cancelled).toEqual([0]);
    expect(harness.coordinator.dragging).toBe(false);
  });

  it("keeps one edge-scroll RAF alive and flushes after each scroll", () => {
    let edgeFrames = 0;
    const harness = createHarness({
      onEdgeFrame() {
        edgeFrames += 1;
        return edgeFrames < 3;
      },
    });
    harness.coordinator.begin(100);
    harness.callbacks.shift()!();
    harness.callbacks.shift()!();
    harness.callbacks.shift()!();

    expect(harness.flushes).toEqual([
      { x: 100, reason: "begin" },
      { x: 100, reason: "frame" },
      { x: 100, reason: "frame" },
    ]);
    expect(harness.callbacks).toHaveLength(0);
  });

  it("ignores moves after end and cancels without emitting a final seek", () => {
    const harness = createHarness();
    harness.coordinator.begin(10);
    harness.coordinator.move(20);
    harness.coordinator.cancel();
    harness.coordinator.move(30);

    expect(harness.flushes).toEqual([{ x: 10, reason: "begin" }]);
    expect(harness.cancelled).toEqual([0]);
  });
});
