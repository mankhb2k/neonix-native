import { createStore, type StoreApi } from "zustand/vanilla";
import type { PlaybackV2Snapshot, WebAudioAdapterV2 } from "@motionvideo/playback-engine-next";

export type TransportUIState = {
  currentTime: number;
  playing: boolean;
  duration: number;
  generation: number;
  audioState: WebAudioAdapterV2["state"] | "uninitialized";
  activeVisualMediaIds: readonly string[];
  activeAudioInputIds: readonly string[];
  performance: PlaybackV2Snapshot["performance"] | null;
};

export type TransportStoreApi = StoreApi<TransportUIState> & {
  publishSnapshot: (
    snapshot: PlaybackV2Snapshot,
    audioState?: TransportUIState["audioState"],
    now?: number,
    duration?: number,
  ) => boolean;
};

export const DEFAULT_TRANSPORT_PUBLICATION_HZ = 20;

export function createTransportStore(
  publicationHz = DEFAULT_TRANSPORT_PUBLICATION_HZ,
): TransportStoreApi {
  const store = createStore<TransportUIState>(() => ({
    currentTime: 0,
    playing: false,
    duration: 0,
    generation: 0,
    audioState: "uninitialized",
    activeVisualMediaIds: [],
    activeAudioInputIds: [],
    performance: null,
  })) as TransportStoreApi;
  let lastPublishedAt = Number.NEGATIVE_INFINITY;
  let lastPerformancePublishedAt = Number.NEGATIVE_INFINITY;
  const intervalMs = 1000 / Math.max(1, publicationHz);

  store.publishSnapshot = (snapshot, audioState = store.getState().audioState, now = performance.now(), duration) => {
    const previous = store.getState();
    const nextDuration = duration ?? previous.duration;
    const transition =
      previous.playing !== snapshot.playing ||
      previous.generation !== snapshot.generation ||
      previous.duration !== nextDuration;
    const finalTime = !snapshot.playing || snapshot.time >= nextDuration;
    if (!transition && !finalTime && now - lastPublishedAt < intervalMs) return false;

    lastPublishedAt = now;
    const publishPerformance =
      transition ||
      finalTime ||
      now - lastPerformancePublishedAt >= 1000;
    if (publishPerformance) lastPerformancePublishedAt = now;
    store.setState({
      currentTime: snapshot.time,
      playing: snapshot.playing,
      duration: nextDuration,
      generation: snapshot.generation,
      audioState,
      activeVisualMediaIds: snapshot.activeVisualMediaIds,
      activeAudioInputIds: snapshot.activeAudioInputIds,
      performance: publishPerformance ? snapshot.performance : previous.performance,
    });
    return true;
  };

  return store;
}
