export type PcmChunkV2 = {
  /** Absolute first sample in the output timeline. */
  startSample: number;
  sampleRate: number;
  channels: number;
  /** Interleaved Float32 PCM. */
  data: Float32Array;
  generation?: number;
};

export type RollingPcmBufferOptionsV2 = {
  maxBytes?: number;
  maxSeconds?: number;
};

export type RollingPcmBufferStatsV2 = {
  chunks: number;
  bytes: number;
  startSample: number | null;
  endSample: number | null;
  evictedChunks: number;
};

/**
 * Bounded, timestamped PCM queue used between a decoder worker and an audio
 * renderer. It never grows without a byte/seconds budget and drops stale
 * chunks on generation changes.
 */
export type RollingPcmBufferV2 = {
  push(chunk: PcmChunkV2): boolean;
  discardBefore(sample: number): void;
  reset(generation?: number): void;
  getChunks(range?: { startSample: number; endSample: number }): readonly PcmChunkV2[];
  getStats(): RollingPcmBufferStatsV2;
};

function chunkBytes(chunk: PcmChunkV2): number {
  return chunk.data.byteLength;
}

function endSample(chunk: PcmChunkV2): number {
  if (chunk.channels <= 0) return chunk.startSample;
  return chunk.startSample + Math.floor(chunk.data.length / chunk.channels);
}

export function createRollingPcmBufferV2(
  options: RollingPcmBufferOptionsV2 = {},
): RollingPcmBufferV2 {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 8 * 1024 * 1024));
  const maxSeconds = options.maxSeconds === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0.1, options.maxSeconds);
  const chunks: PcmChunkV2[] = [];
  let bytes = 0;
  let evictedChunks = 0;
  let generation: number | undefined;

  const evict = (): void => {
    while (chunks.length > 0) {
      const first = chunks[0]!;
      const last = chunks[chunks.length - 1]!;
      const spanSeconds = last.sampleRate > 0
        ? (endSample(last) - first.startSample) / last.sampleRate
        : 0;
      if (bytes <= maxBytes && spanSeconds <= maxSeconds) break;
      chunks.shift();
      bytes -= chunkBytes(first);
      evictedChunks += 1;
    }
  };

  return {
    push(chunk) {
      if (!Number.isSafeInteger(chunk.startSample) || chunk.startSample < 0) return false;
      if (!Number.isFinite(chunk.sampleRate) || chunk.sampleRate <= 0) return false;
      if (!Number.isSafeInteger(chunk.channels) || chunk.channels <= 0 || chunk.data.length === 0) {
        return false;
      }
      if (generation !== undefined && chunk.generation !== undefined && chunk.generation !== generation) {
        return false;
      }
      if (generation === undefined && chunk.generation !== undefined) generation = chunk.generation;
      const existingIndex = chunks.findIndex((item) => item.startSample === chunk.startSample);
      if (existingIndex >= 0) {
        const existing = chunks[existingIndex]!;
        bytes -= chunkBytes(existing);
        chunks.splice(existingIndex, 1);
      }
      // A single chunk larger than the budget is never retained.
      if (chunkBytes(chunk) > maxBytes) return false;
      chunks.push(chunk);
      chunks.sort((left, right) => left.startSample - right.startSample);
      bytes += chunkBytes(chunk);
      evict();
      return chunks.includes(chunk);
    },
    discardBefore(sample) {
      while (chunks.length > 0 && endSample(chunks[0]!) <= sample) {
        const removed = chunks.shift()!;
        bytes -= chunkBytes(removed);
      }
    },
    reset(nextGeneration) {
      chunks.length = 0;
      bytes = 0;
      generation = nextGeneration;
    },
    getChunks(range) {
      if (!range) return chunks.slice();
      return chunks.filter((chunk) => endSample(chunk) > range.startSample && chunk.startSample < range.endSample);
    },
    getStats() {
      return {
        chunks: chunks.length,
        bytes,
        startSample: chunks[0]?.startSample ?? null,
        endSample: chunks.length > 0 ? endSample(chunks[chunks.length - 1]!) : null,
        evictedChunks,
      };
    },
  };
}
