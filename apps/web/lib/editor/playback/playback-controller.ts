import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  createDOMMediaControllerV2,
  createVideoMediaSession,
  createPlaybackEngineV2,
  createWebAudioAdapterV2,
  type PlaybackEngineV2,
  type PlaybackMediaStatsV2,
  type PlaybackPerformanceSampleV2,
  type PlaybackV2Snapshot,
  type WebAudioAdapterV2,
  type WebAudioDiagnosticV2,
} from "@motionvideo/playback-engine-next";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { RuntimeFrameV2 } from "@motionvideo/motion-runtime";

export type PlaybackControllerDiagnostic = {
  source: "audio" | "media";
  code: string;
  message: string;
  assetId?: string;
  uri?: string;
};

export type PlaybackOperationToken = {
  /** Authoring/resource document generation. */
  documentGeneration: number;
  /** Runtime transport generation from PlaybackEngineV2. */
  transportGeneration: number;
  /** Monotonic seek request id; latest request wins. */
  seekRequestId: number;
};

export type PlaybackFrameEvent = PlaybackOperationToken & {
  time: number;
  frame: RuntimeFrameV2;
  playing: boolean;
  /** Backwards-compatible alias for transportGeneration. */
  generation: number;
};

export type PlaybackTimeEvent = PlaybackOperationToken & {
  time: number;
  playing: boolean;
  /** Backwards-compatible alias for transportGeneration. */
  generation: number;
};

export type PlaybackControllerOptions = {
  onSnapshot?: (snapshot: PlaybackV2Snapshot) => void;
  onDiagnostic?: (diagnostic: PlaybackControllerDiagnostic) => void;
  collectPerformanceMetrics?: boolean;
  performanceSampleCapacity?: number;
};

export type PlaybackController = {
  loadDocument(document: MotionProtocolV2, currentTime: number): void;
  play(): Promise<boolean>;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  previewAt(time: number): void;
  registerFrameSink(sink: (event: PlaybackFrameEvent) => void): () => void;
  registerTimeSink(sink: (event: PlaybackTimeEvent) => void): () => void;
  setHiddenLayerIds(layerIds: readonly string[]): void;
  registerVideo(
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ): () => void;
  /** Forward host memory pressure to the shared video preload policy. */
  setMemoryPressure(pressure: boolean): void;
  getSnapshot(): PlaybackV2Snapshot | null;
  getResourceStats(): {
    registeredVideos: number;
    cachedAudioBuffers: number;
    activeAudioSources: number;
    lateAudioSchedules: number;
    maxAudioScheduleLateMs: number;
  };
  getDiagnostics(): {
    performanceSamples: readonly PlaybackPerformanceSampleV2[];
    media: PlaybackMediaStatsV2;
  };
  readonly playing: boolean;
  readonly duration: number;
  readonly audioState: WebAudioAdapterV2["state"] | "uninitialized";
  dispose(): void;
};

/**
 * Imperative per-editor owner of the realtime playback resources.
 *
 * React may expose this through a stable context value, but frame scheduling,
 * media registration, and audio resume never depend on React render timing.
 */
export function createPlaybackController(
  options: PlaybackControllerOptions = {},
): PlaybackController {
  const videos = new Map<string, HTMLVideoElement>();
  let disposed = false;
  let operationGeneration = 0;
  let documentGeneration = 0;
  let seekRequestId = 0;
  let latestSnapshot: PlaybackV2Snapshot | null = null;
  let latestRawSnapshot: PlaybackV2Snapshot | null = null;
  const frameSinks = new Set<(event: PlaybackFrameEvent) => void>();
  const timeSinks = new Set<(event: PlaybackTimeEvent) => void>();
  let hiddenLayerIds = new Set<string>();
  let layerParents = new Map<string, string | null>();

  const recomputeHiddenLayerIds = (ids: readonly string[]) => {
    const expanded = new Set(ids);
    for (const id of ids) {
      let parentId = layerParents.get(id) ?? null;
      while (parentId != null) {
        if (expanded.has(parentId)) break;
        expanded.add(parentId);
        parentId = layerParents.get(parentId) ?? null;
      }
    }
    hiddenLayerIds = expanded;
  };

  const isVisibleCommand = (command: RuntimeFrameV2["commands"][number]) => {
    const layerId = "layerId" in command ? command.layerId : undefined;
    return typeof layerId !== "string" || !hiddenLayerIds.has(layerId);
  };

  const filterFrame = (frame: RuntimeFrameV2): RuntimeFrameV2 => {
    if (hiddenLayerIds.size === 0) return frame;
    const hiddenScopes: string[] = [];
    const commands: RuntimeFrameV2["commands"] = [];
    for (const command of frame.commands) {
      if (command.op === "beginFrame" || command.op === "endFrame") {
        commands.push(command);
        continue;
      }
      if (command.op === "beginGroup" || command.op === "beginLayer") {
        const hidden = hiddenScopes.length > 0 || !isVisibleCommand(command);
        if (hidden) hiddenScopes.push(command.key);
        else commands.push(command);
        continue;
      }
      if (command.op === "endGroup" || command.op === "endLayer") {
        const hiddenIndex = hiddenScopes.lastIndexOf(command.key);
        if (hiddenIndex >= 0) {
          hiddenScopes.splice(hiddenIndex, 1);
          continue;
        }
        if (hiddenScopes.length > 0) continue;
      }
      if (hiddenScopes.length > 0 || !isVisibleCommand(command)) continue;
      commands.push(command);
    }
    return { ...frame, commands };
  };

  const visibleSnapshot = (snapshot: PlaybackV2Snapshot): PlaybackV2Snapshot => {
    const frame = snapshot.frame ? filterFrame(snapshot.frame) : null;
    const mediaCommands = frame?.commands.filter(
      (command): command is PlaybackV2Snapshot["mediaCommands"][number] => command.op === "drawVideo",
    ) ?? [];
    return {
      ...snapshot,
      frame,
      mediaCommands,
      activeVisualMediaIds: mediaCommands
        .filter((command) => command.mediaVisible !== false)
        .map((command) => command.assetId),
    };
  };

  const reportAudioDiagnostic = (diagnostic: WebAudioDiagnosticV2) => {
    options.onDiagnostic?.({ source: "audio", ...diagnostic });
  };

  const videoSession = createVideoMediaSession();
  const audio = createWebAudioAdapterV2({ onDiagnostic: reportAudioDiagnostic });
  const rawMedia = createDOMMediaControllerV2({
    resolveVideo: (assetId) => videos.get(assetId) ?? null,
    session: videoSession,
    onError: (assetId, error) => {
      options.onDiagnostic?.({
        source: "media",
        code: "media-play-rejected",
        message: error.message,
        assetId,
      });
    },
  });
  const media = {
    sync(commands: Parameters<typeof rawMedia.sync>[0], context: Parameters<typeof rawMedia.sync>[1]) {
      return rawMedia.sync(commands.filter(isVisibleCommand), context);
    },
    pauseAll: () => rawMedia.pauseAll(),
    dispose: () => rawMedia.dispose(),
  };
  const engine: PlaybackEngineV2 = createPlaybackEngineV2(
    {
      prefetchAudioMixPlan: (plan) => audio.prefetchAudioMixPlan(plan),
      prepareAudioMixPlan: (plan) => audio.prepareAudioMixPlan(plan),
      consumeAudioMixPlan: (plan, context) => audio.consumeAudioMixPlan(plan, context),
      pauseAudio: () => audio.pause(),
      paintCompositionFrame: (frame, context) => {
        const visibleFrame = filterFrame(frame);
        emitFrame({
          time: visibleFrame.time,
          frame: visibleFrame,
          playing: context.playing,
          documentGeneration,
          transportGeneration: context.generation,
          seekRequestId,
          generation: context.generation,
        });
      },
      onSnapshot: (snapshot) => {
        latestRawSnapshot = snapshot;
        latestSnapshot = visibleSnapshot(snapshot);
        emitTime({
          time: latestSnapshot.time,
          playing: latestSnapshot.playing,
          documentGeneration,
          transportGeneration: latestSnapshot.generation,
          seekRequestId,
          generation: latestSnapshot.generation,
        });
        options.onSnapshot?.(latestSnapshot);
      },
    },
    {
      media,
      collectPerformanceMetrics: options.collectPerformanceMetrics ?? false,
      performanceSampleCapacity: options.performanceSampleCapacity,
    },
  );

  function emitFrame(event: PlaybackFrameEvent): void {
    for (const sink of frameSinks) sink(event);
  }

  function emitTime(event: PlaybackTimeEvent): void {
    for (const sink of timeSinks) sink(event);
  }

  const invalidatePendingOperation = () => {
    operationGeneration += 1;
    return operationGeneration;
  };

  const resumeAndPlay = async (generationAtRequest: number): Promise<boolean> => {
    const resumed = await audio.resume();
    if (!resumed || disposed || generationAtRequest !== operationGeneration) return false;
    // Preparation is a readiness barrier, not a reason to stop the visual
    // transport. A missing derivative is reported by the adapter while other
    // independent audio inputs may still be valid and should keep playing.
    await engine.prepareAudioAt(engine.currentTime);
    if (disposed || generationAtRequest !== operationGeneration) return false;
    engine.play();
    return true;
  };

  const play = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    const generationAtRequest = invalidatePendingOperation();
    return resumeAndPlay(generationAtRequest);
  };

  const pause = (): void => {
    if (disposed) return;
    invalidatePendingOperation();
    engine.pause();
  };

  return {
    loadDocument(document, currentTime) {
      if (disposed) return;
      const shouldResume = engine.playing;
      const generationAtRequest = invalidatePendingOperation();
      documentGeneration += 1;
      seekRequestId += 1;
      layerParents = new Map(document.layers.map((layer) => [layer.id, layer.parentLayerId]));
      recomputeHiddenLayerIds([...hiddenLayerIds]);
      engine.load(compileProtocolV2(document));
      engine.previewFrameAt(currentTime);
      if (shouldResume) void resumeAndPlay(generationAtRequest);
    },

    play,

    pause,

    toggle() {
      if (engine.playing) pause();
      else void play();
    },

    seek(time) {
      if (disposed) return;
      invalidatePendingOperation();
      seekRequestId += 1;
      engine.seek(time);
    },

    previewAt(time) {
      if (disposed) return;
      invalidatePendingOperation();
      seekRequestId += 1;
      engine.previewFrameAt(time);
    },

    registerFrameSink(sink) {
      if (disposed) return () => undefined;
      frameSinks.add(sink);
      // A stage can mount after the provider has loaded the document. Replay
      // the deterministic snapshot once so the canvas is not left at time 0
      // until the next transport tick.
      if (latestSnapshot?.frame) {
        sink({
          time: latestSnapshot.time,
          frame: latestSnapshot.frame,
          playing: latestSnapshot.playing,
          documentGeneration,
          transportGeneration: latestSnapshot.generation,
          seekRequestId,
          generation: latestSnapshot.generation,
        });
      }
      return () => frameSinks.delete(sink);
    },

    registerTimeSink(sink) {
      if (disposed) return () => undefined;
      timeSinks.add(sink);
      if (latestSnapshot) {
        sink({
          time: latestSnapshot.time,
          playing: latestSnapshot.playing,
          documentGeneration,
          transportGeneration: latestSnapshot.generation,
          seekRequestId,
          generation: latestSnapshot.generation,
        });
      }
      return () => timeSinks.delete(sink);
    },

    setHiddenLayerIds(layerIds) {
      recomputeHiddenLayerIds(layerIds);
      if (!latestRawSnapshot) return;
      latestSnapshot = visibleSnapshot(latestRawSnapshot);
      options.onSnapshot?.(latestSnapshot);
      if (latestSnapshot.frame) {
        emitFrame({
          time: latestSnapshot.time,
          frame: latestSnapshot.frame,
          playing: latestSnapshot.playing,
          documentGeneration,
          transportGeneration: latestSnapshot.generation,
          seekRequestId,
          generation: latestSnapshot.generation,
        });
      }
    },

    registerVideo(assetId, element, onFrameReady) {
      if (disposed) return () => undefined;
      videos.set(assetId, element);
      const releaseSession = videoSession.register(assetId, element, onFrameReady);
      const snapshot = latestSnapshot;
      if (snapshot) {
        void media.sync(snapshot.mediaCommands, {
          time: snapshot.time,
          playing: snapshot.playing,
          generation: snapshot.generation,
        });
      }
      return () => {
        if (videos.get(assetId) !== element) return;
        videos.delete(assetId);
        releaseSession();
        media.pauseAll();
      };
    },

    setMemoryPressure(pressure) {
      videoSession.setMemoryPressure(pressure);
    },

    getSnapshot() {
      return latestSnapshot;
    },

    getResourceStats() {
      const audioStats = audio.getResourceStats();
      return {
        registeredVideos: videos.size,
        cachedAudioBuffers: audioStats.cachedBuffers,
        activeAudioSources: audioStats.activeSources,
        lateAudioSchedules: audioStats.lateScheduleCount,
        maxAudioScheduleLateMs: audioStats.maxScheduleLateMs,
      };
    },

    getDiagnostics() {
      return {
        performanceSamples: engine.getPerformanceSamples(),
        media: rawMedia.getStats?.() ?? {
          syncCalls: 0,
          activeVideos: 0,
          seekRequests: 0,
          suppressedSeeks: 0,
          hardCorrections: 0,
          playRequests: 0,
          playRejections: 0,
          decodedFrameCallbacks: 0,
        },
      };
    },

    get playing() {
      return engine.playing;
    },

    get duration() {
      return engine.duration;
    },

    get audioState() {
      return audio.state;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      invalidatePendingOperation();
      engine.dispose();
      audio.dispose();
      videos.clear();
      frameSinks.clear();
      timeSinks.clear();
      latestSnapshot = null;
      latestRawSnapshot = null;
    },
  };
}
