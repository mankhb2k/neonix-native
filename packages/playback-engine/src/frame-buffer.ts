/**
 * FrameBuffer — bounded, sorted collection of rendered frames for the
 * playback engine's look-ahead pipeline.
 *
 * §Phase 9 Task 9.3 in core-engine-tasks.md
 *
 * Frames are stored sorted by composition time. The buffer has a capacity
 * limit; when exceeded, the frame closest to the playhead (oldest) is evicted.
 * Stale frames (mismatched sequence ID) are dropped on insertion.
 *
 * Modeled after clipkit's FrameBuffer but pure-TypeScript, no VideoFrame dep.
 */

import type { WorkerSequenceId } from "@motionvideo/render-contracts";

// ── Types ─────────────────────────────────────────────────────────────

export type FrameBufferEntry = {
  /** Composition time (seconds). */
  time: number;
  /** The rendered frame (opaque — consumer decides the format). */
  data: unknown;
  /** Sequence ID at time of production. */
  sequenceId: WorkerSequenceId;
  /** Wall-clock timestamp when the frame was produced. */
  producedAt: number;
};

export type BufferStatus = {
  /** Number of frames currently buffered. */
  bufferedFrames: number;
  /** Latest frame time in the buffer. */
  latestTime: number;
  /** Seconds of content buffered ahead of the given playhead. */
  aheadSec: number;
  /** Whether the buffer has no frame at or before the playhead. */
  starved: boolean;
};

export type FrameBufferOptions = {
  /** Maximum buffer capacity in frames. */
  capacity?: number;
  /**
   * Target buffer size in seconds (used for capacity auto-sizing).
   * Default: 3.0 seconds.
   */
  targetSec?: number;
};

// ── Implementation ────────────────────────────────────────────────────

export type FrameBuffer = {
  /** Insert a rendered frame into the buffer. */
  push(entry: FrameBufferEntry): void;

  /**
   * Get the latest frame whose time ≤ playhead.
   * Returns null if buffer is empty or all frames are ahead of playhead.
   */
  peekAt(playhead: number): FrameBufferEntry | null;

  /**
   * How many seconds of content are ahead of the given playhead.
   */
  aheadSec(playhead: number): number;

  /**
   * Remove frames behind the playhead (keeping `keepBackSec` for resilience).
   */
  prune(playhead: number, keepBackSec?: number): void;

  /**
   * Evict all frames with a stale (non-matching) sequence ID.
   */
  setSequenceId(id: WorkerSequenceId): void;

  /** Current number of entries. */
  readonly size: number;

  /** Get buffer status relative to a playhead. */
  status(playhead: number, fps: number): BufferStatus;

  /** Drop all frames. */
  clear(): void;

  /** Dispose (alias for clear + release references). */
  dispose(): void;
};

export function createFrameBuffer(opts?: FrameBufferOptions): FrameBuffer {
  const capacity = opts?.capacity ?? 128;

  // Sorted array by time (ascending), maintained on push
  let entries: FrameBufferEntry[] = [];
  let currentSequenceId: WorkerSequenceId = -1; // -1 = accept all (not yet set)
  let latestTime = -1;

  function push(entry: FrameBufferEntry): void {
    // Drop stale frames, but only when a sequence has been set
    if (currentSequenceId >= 0 && entry.sequenceId !== currentSequenceId)
      return;

    // Drop if we already have a newer frame at the same time
    const existingIdx = entries.findIndex((e) => e.time === entry.time);
    if (existingIdx >= 0) {
      if (entries[existingIdx]!.sequenceId <= entry.sequenceId) {
        entries.splice(existingIdx, 1);
      } else {
        return; // existing is newer
      }
    }

    // Insert sorted by time
    let inserted = false;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i]!.time > entry.time) {
        entries.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      entries.push(entry);
    }

    // Evict if over capacity
    while (entries.length > capacity) {
      // Remove the oldest frame
      entries.shift();
    }

    if (entry.time > latestTime) {
      latestTime = entry.time;
    }
  }

  function peekAt(playhead: number): FrameBufferEntry | null {
    let best: FrameBufferEntry | null = null;
    for (const entry of entries) {
      if (entry.time > playhead) break;
      best = entry;
    }
    return best;
  }

  function aheadSec(playhead: number): number {
    if (entries.length === 0) return 0;
    const last = entries[entries.length - 1]!;
    return Math.max(0, last.time - playhead);
  }

  function prune(playhead: number, keepBackSec = 0.05): void {
    const cutoff = playhead - keepBackSec;
    entries = entries.filter((e) => e.time >= cutoff);
  }

  function setSequenceId(id: WorkerSequenceId): void {
    currentSequenceId = id;
    // Drop all frames from previous sequences
    entries = entries.filter((e) => e.sequenceId === id);
  }

  function status(playhead: number, _fps: number): BufferStatus {
    const buffered = entries.length;
    const ahead = aheadSec(playhead);
    const peeked = peekAt(playhead);
    return {
      bufferedFrames: buffered,
      latestTime,
      aheadSec: ahead,
      starved: peeked === null,
    };
  }

  function clear(): void {
    entries = [];
    latestTime = -1;
  }

  function dispose(): void {
    clear();
  }

  return {
    push,
    peekAt,
    aheadSec,
    prune,
    setSequenceId,
    get size() {
      return entries.length;
    },
    status,
    clear,
    dispose,
  };
}
