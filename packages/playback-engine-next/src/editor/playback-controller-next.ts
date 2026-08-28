import type { RuntimeProjectV3, RuntimeAudioMixPlanV3, VideoRenderPlanV3 } from "@motionvideo/motion-runtime";
import { createPlaybackEngineNext } from "../core/playback-engine";
import type { PlaybackEngineNext, PlaybackEngineNextOptions, PlaybackEngineNextSnapshot } from "../core/types";
import { createScrubCoordinatorV3, type ScrubCoordinatorV3 } from "./scrub-coordinator";
import { createPlaybackSnapshotStoreV3 } from "./transport-store";

export type PlaybackControllerNextOptionsV3 = PlaybackEngineNextOptions & { onSnapshot?: (snapshot: PlaybackEngineNextSnapshot) => void; onVideoPlan?: (plan: VideoRenderPlanV3) => void; onAudioPlan?: (plan: RuntimeAudioMixPlanV3) => void };
export type PlaybackControllerNextV3 = { load(project: RuntimeProjectV3): void; play(): void; pause(): void; toggle(): void; seek(timeUs: number): void; previewAt(timeUs: number): void; tick(): void; beginScrub(): void; updateScrub(timeUs: number): void; endScrub(): void; registerSnapshotSink(sink: (snapshot: PlaybackEngineNextSnapshot) => void): () => void; getSnapshot(): PlaybackEngineNextSnapshot; readonly scrub: ScrubCoordinatorV3; dispose(): void };

export function createPlaybackControllerNextV3(options: PlaybackControllerNextOptionsV3 = {}): PlaybackControllerNextV3 {
  const snapshots = new Set<(snapshot: PlaybackEngineNextSnapshot) => void>();
  const videoSink = options.videoSink ?? { publish: (plan: VideoRenderPlanV3) => options.onVideoPlan?.(plan) };
  const audioSink = options.audioSink ?? { publish: (plan: RuntimeAudioMixPlanV3) => options.onAudioPlan?.(plan) };
  const engineOptions: PlaybackEngineNextOptions = { ...options, videoSink, audioSink };
  const engine: PlaybackEngineNext = createPlaybackEngineNext(engineOptions);
  let disposed = false;
  const store = createPlaybackSnapshotStoreV3(engine.snapshot());
  store.subscribe(() => { const snapshot = store.getSnapshot(); for (const sink of snapshots) sink(snapshot); });
  const emit = () => { const snapshot = engine.snapshot(); store.publish(snapshot); options.onSnapshot?.(snapshot); };
  const scrub = createScrubCoordinatorV3((timeUs) => { engine.seek(timeUs); emit(); }, () => { engine.play(); emit(); });
  const play = () => { if (disposed) return; engine.play(); emit(); };
  const pause = () => { if (disposed) return; engine.pause(); emit(); };
  const toggle = () => { if (engine.snapshot().state === "playing") pause(); else play(); };
  return { load(project) { if (disposed) return; engine.load(project); emit(); }, play, pause, toggle, seek(timeUs) { if (disposed) return; engine.seek(timeUs); emit(); }, previewAt(timeUs) { if (disposed) return; engine.seek(timeUs); emit(); }, tick() { if (disposed) return; engine.tick(); emit(); }, beginScrub() { scrub.begin(engine.snapshot().state === "playing"); engine.pause(); emit(); }, updateScrub(timeUs) { scrub.update(timeUs); }, endScrub() { if (scrub.end()) return; emit(); }, registerSnapshotSink(sink) { if (disposed) return () => undefined; snapshots.add(sink); sink(store.getSnapshot()); return () => snapshots.delete(sink); }, getSnapshot: () => store.getSnapshot(), scrub, dispose() { if (disposed) return; disposed = true; engine.dispose(); snapshots.clear(); } };
}
