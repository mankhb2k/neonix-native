import type { PlaybackClockV3 } from "../core/types";

export type AudioClockLikeV3 = { currentTime: number; addEventListener?: (type: string, listener: () => void) => void };

/** Adapter seam for an AudioContext/media element clock; no Web Audio dependency here. */
export function createAudioClockSourceV3(readTime: () => number, seek?: (timeUs: number) => void): PlaybackClockV3 {
  return {
    source: "audio",
    nowUs: () => Math.max(0, readTime()),
    setPlaying(_next, atUs) { if (atUs !== undefined) seek?.(atUs); },
    seek(next) { seek?.(Math.max(0, next)); },
  };
}

export type { PlaybackClockV3 };
