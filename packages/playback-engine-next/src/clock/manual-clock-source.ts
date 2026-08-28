import type { PlaybackClockV3 } from "../core/types";

export function createManualClockSourceV3(initialUs = 0): PlaybackClockV3 & { advance(deltaUs: number): void } {
  let timeUs = initialUs;
  let playing = false;
  return { source: "fake", nowUs: () => timeUs, setPlaying(next, atUs = timeUs) { playing = next; timeUs = atUs; }, seek(next) { timeUs = Math.max(0, next); }, advance(deltaUs) { if (playing) timeUs += Math.max(0, deltaUs); } };
}

export const createFakeClock = createManualClockSourceV3;
export type ManualClockSourceV3 = ReturnType<typeof createManualClockSourceV3>;
