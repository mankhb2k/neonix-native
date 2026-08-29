import type { PlaybackEngineSnapshot } from "../core/types";

export type PlaybackSnapshotStoreV3 = { getSnapshot(): PlaybackEngineSnapshot; subscribe(listener: () => void): () => void; publish(snapshot: PlaybackEngineSnapshot): void };

/** Coalesces rapid engine ticks so UI subscribers do not render once per RAF. */
export function createPlaybackSnapshotStoreV3(initial: PlaybackEngineSnapshot): PlaybackSnapshotStoreV3 {
  let snapshot = initial;
  let queued = false;
  const listeners = new Set<() => void>();
  const notify = () => { queued = false; for (const listener of listeners) listener(); };
  return { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, publish(next) { snapshot = next; if (queued) return; queued = true; queueMicrotask(notify); } };
}
