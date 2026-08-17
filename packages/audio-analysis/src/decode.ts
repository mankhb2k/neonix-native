/**
 * Audio decode helpers.
 *
 * Browser path uses the Web Audio API (`AudioContext.decodeAudioData`).
 * Server/desktop paths should decode via ffmpeg (or a native decoder) and
 * hand the resulting mono PCM to `analyzePcm` directly — the analysis core
 * itself is decode-agnostic.
 */

export type MonoPcm = {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
};

/** Mix planar channel data down to a single mono Float32Array. */
export function mixChannelsToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const length = channels.reduce((max, c) => Math.max(max, c.length), 0);
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      out[i] += channel[i] / channels.length;
    }
  }
  return out;
}

/** Convert a Web Audio `AudioBuffer` into mono PCM. */
export function audioBufferToMonoPcm(buffer: AudioBuffer): MonoPcm {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  return {
    samples: mixChannelsToMono(channels),
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
  };
}

/** Fetch a URL and decode it to mono PCM (browser). */
export async function decodeAudioFromUrl(
  url: string,
  audioContext?: AudioContext,
): Promise<MonoPcm> {
  const ctx = audioContext ?? new AudioContext();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from "${url}": HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBufferToMonoPcm(buffer);
}
