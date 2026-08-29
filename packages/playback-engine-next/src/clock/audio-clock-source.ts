import type { PlaybackClockV3 } from "../core/types";

export type AudioClockLikeV3 = { currentTime: number; addEventListener?: (type: string, listener: () => void) => void };

/** Adapter seam for an AudioContext/media element clock. The host clock is seconds; PlaybackEngine uses microseconds. */
export function createAudioClockSourceV3(readTimeSeconds: () => number, seek?: (timeUs: number) => void): PlaybackClockV3 {
  return {
    source: "audio",
    nowUs: () => Math.max(0, readTimeSeconds() * 1_000_000),
    start(atUs) { if (atUs !== undefined) seek?.(atUs); },
    pause(atUs) { if (atUs !== undefined) seek?.(atUs); return atUs ?? Math.max(0, readTimeSeconds() * 1_000_000); },
    seek(next) { seek?.(Math.max(0, next)); },
  };
}

/** Clock adapter for the rendered-sample counter reported by StreamingWorklet. */
export function createRenderedSampleClockSourceV3(readRenderedSamples: () => number, sampleRate = 48_000, seek?: (sample: number) => void): PlaybackClockV3 {
  return {
    source: "audio",
    nowUs: () => Math.max(0, readRenderedSamples()) / sampleRate * 1_000_000,
    start(atUs) { if (atUs !== undefined) seek?.(Math.max(0, Math.floor(atUs / 1_000_000 * sampleRate))); },
    pause(atUs) { if (atUs !== undefined) seek?.(Math.max(0, Math.floor(atUs / 1_000_000 * sampleRate))); return atUs ?? Math.max(0, readRenderedSamples()) / sampleRate * 1_000_000; },
    seek(timeUs) { seek?.(Math.max(0, Math.floor(timeUs / 1_000_000 * sampleRate))); },
  };
}

/** Transport clock for the StreamingWorklet rendered-sample counter. */
export const createAudioSampleTransportClockV3 = createRenderedSampleClockSourceV3;

export type { PlaybackClockV3 };
