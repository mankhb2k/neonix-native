import { describe, expect, it } from "vitest";
import { createAnimationFrameSchedulerV3 } from "./animation-frame-scheduler";

describe("animation frame scheduler", () => {
  it("adapts browser callbacks without leaking browser APIs into core", () => {
    let callback: FrameRequestCallback | undefined;
    let cancelled = -1;
    const scheduler = createAnimationFrameSchedulerV3({ requestAnimationFrame(next) { callback = next; return 7; }, cancelAnimationFrame(handle) { cancelled = handle; } });
    let ticks = 0;
    expect(scheduler.request(() => { ticks += 1; })).toBe(7);
    callback?.(0);
    scheduler.cancel(7);
    expect({ ticks, cancelled }).toEqual({ ticks: 1, cancelled: 7 });
  });
});
