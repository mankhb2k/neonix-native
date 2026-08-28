import type { PlaybackClockV3 } from "../core/types";

export function createMonotonicClock(nowMs: () => number = () => Date.now()): PlaybackClockV3 {
  let anchorUs = 0;
  let anchorMs = nowMs();
  let playing = false;
  return {
    source: "monotonic",
    nowUs: () => playing ? anchorUs + (nowMs() - anchorMs) * 1000 : anchorUs,
    setPlaying(next, atUs) { anchorUs = atUs ?? (playing ? anchorUs + (nowMs() - anchorMs) * 1000 : anchorUs); anchorMs = nowMs(); playing = next; },
    seek(next) { anchorUs = Math.max(0, next); anchorMs = nowMs(); },
  };
}
