export type VideoFrameV2 = {
  timestamp: number;
  duration?: number;
  close?(): void;
};

export type VideoFrameQueueStatsV2 = {
  frames: number;
  droppedFrames: number;
  generation: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
};

export type VideoFrameQueueV2 = {
  push(frame: VideoFrameV2, generation: number): boolean;
  takeAt(timestamp: number, generation: number): VideoFrameV2 | null;
  reset(generation: number): void;
  clear(): void;
  getStats(): VideoFrameQueueStatsV2;
};

export type VideoFrameQueueOptionsV2 = {
  maxFrames?: number;
  /** Frames newer than this timestamp can be kept for future presentation. */
  maxAheadSeconds?: number;
};

export function createVideoFrameQueueV2(options: VideoFrameQueueOptionsV2 = {}): VideoFrameQueueV2 {
  const maxFrames = Math.max(1, Math.floor(options.maxFrames ?? 8));
  const maxAheadSeconds = Math.max(0.1, options.maxAheadSeconds ?? 2);
  const frames: VideoFrameV2[] = [];
  let generation = 0;
  let droppedFrames = 0;

  const close = (frame: VideoFrameV2) => {
    try { frame.close?.(); } catch { /* best effort */ }
  };

  const trim = (referenceTimestamp: number | null = null) => {
    while (frames.length > maxFrames) {
      close(frames.shift()!);
      droppedFrames += 1;
    }
    if (referenceTimestamp === null) return;
    while (frames.length > 0 && frames[0]!.timestamp < referenceTimestamp - maxAheadSeconds * 1_000_000) {
      close(frames.shift()!);
      droppedFrames += 1;
    }
  };

  return {
    push(frame, frameGeneration) {
      if (frameGeneration !== generation || !Number.isFinite(frame.timestamp)) {
        close(frame);
        droppedFrames += 1;
        return false;
      }
      const duplicate = frames.findIndex((item) => item.timestamp === frame.timestamp);
      if (duplicate >= 0) close(frames.splice(duplicate, 1)[0]!);
      frames.push(frame);
      frames.sort((left, right) => left.timestamp - right.timestamp);
      trim();
      return frames.includes(frame);
    },
    takeAt(timestamp, frameGeneration) {
      if (frameGeneration !== generation) return null;
      let selectedIndex = -1;
      for (let index = 0; index < frames.length; index += 1) {
        if (frames[index]!.timestamp <= timestamp) selectedIndex = index;
        else break;
      }
      if (selectedIndex < 0) return null;
      const staleFrames = frames.splice(0, selectedIndex);
      for (const stale of staleFrames) close(stale);
      const selected = frames.shift()!;
      return selected;
    },
    reset(nextGeneration) {
      for (const frame of frames) close(frame);
      frames.length = 0;
      generation = nextGeneration;
    },
    clear() {
      for (const frame of frames) close(frame);
      frames.length = 0;
    },
    getStats() {
      return {
        frames: frames.length,
        droppedFrames,
        generation,
        firstTimestamp: frames[0]?.timestamp ?? null,
        lastTimestamp: frames.at(-1)?.timestamp ?? null,
      };
    },
  };
}

export type VideoBackendV2 = "webcodecs" | "html-video";

export function chooseVideoBackendV2(options: {
  preferWebCodecs?: boolean;
  webCodecsAvailable?: boolean;
  demuxAvailable?: boolean;
} = {}): VideoBackendV2 {
  return options.preferWebCodecs && options.webCodecsAvailable && options.demuxAvailable
    ? "webcodecs"
    : "html-video";
}

export type WebCodecsVideoDecoderV2 = {
  decode(chunk: unknown, generation: number): void;
  flush(generation: number): Promise<void>;
  reset(generation: number): void;
  close(): void;
};

export function createWebCodecsVideoDecoderV2(options: {
  decode: (chunk: unknown, output: (frame: VideoFrameV2, generation: number) => void) => void;
  queue: VideoFrameQueueV2;
}): WebCodecsVideoDecoderV2 {
  let generation = 0;
  let closed = false;
  return {
    decode(chunk, chunkGeneration) {
      if (closed || chunkGeneration !== generation) return;
      options.decode(chunk, (frame, frameGeneration) => {
        if (!closed) options.queue.push(frame, frameGeneration);
        else frame.close?.();
      });
    },
    async flush(flushGeneration) {
      if (closed || flushGeneration !== generation) return;
    },
    reset(nextGeneration) {
      generation = nextGeneration;
      options.queue.reset(nextGeneration);
    },
    close() {
      if (closed) return;
      closed = true;
      options.queue.clear();
    },
  };
}
