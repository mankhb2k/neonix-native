import type { PlaybackSchedulerV3 } from "./types";

export type AnimationFrameHostV3 = { requestAnimationFrame(callback: FrameRequestCallback): number; cancelAnimationFrame(handle: number): void };

/** Browser scheduler injected at the edge; core remains deterministic in tests and SSR. */
export function createAnimationFrameSchedulerV3(host: AnimationFrameHostV3): PlaybackSchedulerV3 {
  return {
    request(callback) { return host.requestAnimationFrame(() => callback()); },
    cancel(handle) { host.cancelAnimationFrame(handle); },
  };
}
