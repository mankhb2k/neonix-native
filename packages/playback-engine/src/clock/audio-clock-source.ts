import type { PlaybackClockV3 } from "../core/types";

export type AudioClockLikeV3 = { currentTime: number; addEventListener?: (type: string, listener: () => void) => void };

/** Adapter seam for an AudioContext/media element clock. The host clock is seconds; PlaybackEngine uses microseconds. */
export function createAudioClockSourceV3(readTimeSeconds: () => number, seek?: (timeUs: number) => void): PlaybackClockV3 {
  let anchorContextSeconds = readTimeSeconds();
  let anchorTimelineUs = 0;
  let playing = false;
  let rate = 1;
  const current = () => playing ? anchorTimelineUs + (readTimeSeconds() - anchorContextSeconds) * 1_000_000 * rate : anchorTimelineUs;
  return {
    source: "audio",
    nowUs: () => Math.max(0, current()),
    start(atUs) { anchorTimelineUs = atUs ?? current(); anchorContextSeconds = readTimeSeconds(); playing = true; if (atUs !== undefined) seek?.(atUs); },
    pause(atUs) { anchorTimelineUs = atUs ?? current(); anchorContextSeconds = readTimeSeconds(); playing = false; if (atUs !== undefined) seek?.(atUs); return anchorTimelineUs; },
    seek(next) { anchorTimelineUs = Math.max(0, next); anchorContextSeconds = readTimeSeconds(); seek?.(anchorTimelineUs); },
    setRate(next) { anchorTimelineUs = current(); anchorContextSeconds = readTimeSeconds(); rate = Number.isFinite(next) && next > 0 ? next : 1; },
  };
}
/** Clock adapter for the rendered-sample counter reported by StreamingWorklet. */
export function createRenderedSampleClockSourceV3(readRenderedSamples: () => number, sampleRate = 48_000, seek?: (sample: number) => void): PlaybackClockV3 {
  let anchorSample = 0;
  let rate = 1;
  let playing = false;
  const currentSample = () => playing ? anchorSample + (readRenderedSamples() - anchorSample) * rate : anchorSample;
  return {
    source: "audio",
    nowUs: () => Math.max(0, currentSample()) / sampleRate * 1_000_000,
    start(atUs) { anchorSample = atUs === undefined ? readRenderedSamples() : Math.max(0, Math.floor(atUs / 1_000_000 * sampleRate)); playing = true; if (atUs !== undefined) seek?.(anchorSample); },
    pause(atUs) { anchorSample = atUs === undefined ? currentSample() : Math.max(0, Math.floor(atUs / 1_000_000 * sampleRate)); playing = false; if (atUs !== undefined) seek?.(anchorSample); return anchorSample / sampleRate * 1_000_000; },
    seek(timeUs) { anchorSample = Math.max(0, Math.floor(timeUs / 1_000_000 * sampleRate)); seek?.(anchorSample); },
    setRate(next) { anchorSample = currentSample(); rate = Number.isFinite(next) && next > 0 ? next : 1; },
  };
}
/** Transport clock for the StreamingWorklet rendered-sample counter. */
export const createAudioSampleTransportClockV3 = createRenderedSampleClockSourceV3;

export type { PlaybackClockV3 };
