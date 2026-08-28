import type { RuntimeAudioSourceV2 } from "@motionvideo/motion-runtime";
import type { PcmChunkV2, RollingPcmBufferV2 } from "./rolling-pcm-buffer";

export type AudioDecodeRangeV2 = {
  startSample: number;
  endSample: number;
  generation: number;
  signal?: AbortSignal;
};

export type AudioSegmentDecoderV2 = {
  decode(source: RuntimeAudioSourceV2, range: AudioDecodeRangeV2): Promise<readonly PcmChunkV2[]>;
  close?(): void;
};

export type AudioStreamingSessionV2 = {
  ensure(range: AudioDecodeRangeV2): Promise<boolean>;
  reset(generation: number): void;
  close(): void;
  readonly buffer: RollingPcmBufferV2;
};

/**
 * Coordinates a bounded PCM queue with an injected worker/WebCodecs decoder.
 * The decoder owns demux/codec details; this module owns range, generation and
 * memory policy, so seek completions from an old request can never be played.
 */
export function createAudioStreamingSessionV2(
  source: RuntimeAudioSourceV2,
  decoder: AudioSegmentDecoderV2,
  buffer: RollingPcmBufferV2,
): AudioStreamingSessionV2 {
  let generation = 0;
  let closed = false;
  let inFlight: Promise<boolean> | null = null;

  return {
    buffer,
    ensure(range) {
      if (closed || range.generation !== generation) return Promise.resolve(false);
      if (inFlight) return inFlight;
      inFlight = decoder.decode(source, range).then((chunks) => {
        if (closed || range.generation !== generation) return false;
        for (const chunk of chunks) buffer.push({ ...chunk, generation: range.generation });
        return true;
      }).catch(() => false).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    reset(nextGeneration) {
      generation = nextGeneration;
      inFlight = null;
      buffer.reset(nextGeneration);
    },
    close() {
      if (closed) return;
      closed = true;
      inFlight = null;
      buffer.reset();
      decoder.close?.();
    },
  };
}
