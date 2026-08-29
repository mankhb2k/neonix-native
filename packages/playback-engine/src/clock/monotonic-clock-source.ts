import type { PlaybackClockV3 } from "../core/types";

const defaultNowMs = (): number => typeof performance !== "undefined" ? performance.now() : Date.now();

export function createMonotonicClock(nowMs: () => number = defaultNowMs): PlaybackClockV3 {
  let anchorUs = 0;
  let anchorMs = nowMs();
  let playing = false;
  let rate = 1;
  return {
    source: "monotonic",
    nowUs: () => playing ? anchorUs + (nowMs() - anchorMs) * 1000 * rate : anchorUs,
    start(atUs) { anchorUs = atUs ?? (playing ? anchorUs + (nowMs() - anchorMs) * 1000 * rate : anchorUs); anchorMs = nowMs(); playing = true; },
    pause(atUs) { anchorUs = atUs ?? (playing ? anchorUs + (nowMs() - anchorMs) * 1000 * rate : anchorUs); anchorMs = nowMs(); playing = false; return anchorUs; },
    seek(next) { anchorUs = Math.max(0, next); anchorMs = nowMs(); },
    setRate(next) { const current = playing ? anchorUs + (nowMs() - anchorMs) * 1000 * rate : anchorUs; anchorUs = current; anchorMs = nowMs(); rate = Number.isFinite(next) && next > 0 ? next : 1; },
  };
}

/** Explicit transport name; createMonotonicClock is retained for compatibility. */
export const createMonotonicTransportClockV3 = createMonotonicClock;
