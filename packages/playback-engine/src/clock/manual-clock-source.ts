import type { PlaybackClockV3 } from "../core/types";

export function createManualClockSourceV3(initialUs = 0): PlaybackClockV3 & { advance(deltaUs: number): void } {
  let timeUs = initialUs;
  let playing = false;
  let rate = 1;
  return { source: "fake", nowUs: () => timeUs, start(atUs = timeUs) { playing = true; timeUs = atUs; }, pause(atUs = timeUs) { playing = false; timeUs = atUs; return timeUs; }, seek(next) { timeUs = Math.max(0, next); }, setRate(next) { rate = Number.isFinite(next) && next > 0 ? next : 1; }, advance(deltaUs) { if (playing) timeUs += Math.max(0, deltaUs) * rate; } };
}

export const createFakeClock = createManualClockSourceV3;
export type ManualClockSourceV3 = ReturnType<typeof createManualClockSourceV3>;
