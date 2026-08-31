import { createStore, type StoreApi } from "zustand/vanilla";

type TransportPerformance = {
  renderMs: number;
  tickIntervalMs?: number;
  estimatedDroppedFrames?: number;
};

type AudioState = "uninitialized" | "unknown" | "loading" | "ready" | "stalled" | "failed";

export type TransportUIState = {
  currentTime: number;
  playing: boolean;
  duration: number;
  generation: number;
  audioState: AudioState;
  activeVisualMediaIds: readonly string[];
  activeAudioInputIds: readonly string[];
  performance: TransportPerformance | null;
};

export type TransportStoreApi = StoreApi<TransportUIState> & {
  publishTransport: (input: { time: number; playing: boolean; generation: number; duration?: number }) => boolean;
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
  const intervalMs = 1000 / Math.max(1, publicationHz);

  store.publishTransport = (input) => {
    const previous = store.getState();
    const duration = input.duration ?? previous.duration;
    const now = performance.now();
    const transition = previous.playing !== input.playing || previous.generation !== input.generation || previous.duration !== duration;
    if (!transition && input.playing && now - lastPublishedAt < intervalMs) return false;
    lastPublishedAt = now;
    store.setState({ currentTime: input.time, playing: input.playing, generation: input.generation, duration, activeVisualMediaIds: [], activeAudioInputIds: [], performance: previous.performance });
    return true;
  };

  return store;
}
