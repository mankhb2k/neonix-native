import { compileProtocol } from "@motionvideo/motion-compiler";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { evaluateRuntimeProjectV3, frameIndexAtTime, type RuntimeFrameV3, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { createAnimationFrameSchedulerV3, createDriftControllerV3, createPlaybackEngine, createWebAudioGraphBackendV3, requestMediaElementPlayV3, type PlaybackEngine, type PlaybackEngineSnapshot } from "@motionvideo/playback-engine";

export type PlaybackOperationTokenV3 = { documentGeneration: number; transportGeneration: number; seekRequestId: number; generation: number };
export type PlaybackFrameEventV3 = PlaybackOperationTokenV3 & { time: number; frame: RuntimeFrameV3; playing: boolean };
export type PlaybackTimeEventV3 = PlaybackOperationTokenV3 & { time: number; playing: boolean };
export type PlaybackControllerV3 = {
  loadDocument(document: MotionProtocolV2, currentTime: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  previewAt(time: number): void;
  registerFrameSink(sink: (event: PlaybackFrameEventV3) => void): () => void;
  registerTimeSink(sink: (event: PlaybackTimeEventV3) => void): () => void;
  setHiddenLayerIds(layerIds: readonly string[]): void;
  registerVideo(assetId: string, element: HTMLVideoElement, onFrameReady?: () => void): () => void;
  readonly playing: boolean;
  readonly duration: number;
  snapshot(): PlaybackEngineSnapshot;
  dispose(): void;
};

function mediaIdAliases(id: string): readonly string[] {
  return id.startsWith("asset-") ? [id, id.slice("asset-".length)] : [id, `asset-${id}`];
}

/** Editor transport uses the canonical compiler/runtime; rendering remains a Stage concern. */
export function createPlaybackControllerV3(): PlaybackControllerV3 {
  let runtime: RuntimeProjectV3 | undefined;
  let disposed = false;
  let documentGeneration = 0;
  let seekRequestId = 0;
  let duration = 0;
  let lastFrame: RuntimeFrameV3 | undefined;
  const videos = new Map<string, HTMLVideoElement>();
  const driftController = createDriftControllerV3();
  const frames = new Set<(event: PlaybackFrameEventV3) => void>();
  const times = new Set<(event: PlaybackTimeEventV3) => void>();
  const scheduler = createAnimationFrameSchedulerV3(window);
  const emit = (time: number, playing: boolean): void => {
    if (!runtime) return;
    const snapshot = engine.snapshot();
    const token = { documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation };
    const frame = evaluateRuntimeProjectV3(runtime, frameIndexAtTime(time, runtime.visual.composition.fps), { time });
    lastFrame = frame;
    for (const sink of frames) sink({ ...token, time, playing, frame });
    for (const sink of times) sink({ ...token, time, playing });
  };
  const engine: PlaybackEngine = createPlaybackEngine({
    scheduler,
    videoSink: {
      publish(plan) {
        const playing = engine.snapshot().state === "playing";
        const active = new Set<string>();
        for (const request of plan.instances) {
          active.add(request.source.mediaId);
          const element = mediaIdAliases(request.source.mediaId).map((id) => videos.get(id)).find(Boolean);
          if (!element) continue;
          const target = request.mediaTimeUs / 1_000_000;
          // Let a native decoder advance between authoritative timeline seeks.
          // Assigning currentTime on every RAF keeps Chrome in a seek/decode
          // loop and can leave the element stuck at HAVE_METADATA (black frame).
          const decision = driftController.update(plan.timelineTimeUs, element.currentTime * 1_000_000);
          const shouldSeek = !playing || element.paused || decision.action === "hard-seek";
          if (shouldSeek) element.currentTime = target;
          element.muted = true;
          if (playing) {
            if (element.paused) requestMediaElementPlayV3(element, "video");
          } else if (!element.paused) element.pause();
        }
        for (const [mediaId, element] of videos) {
          if (!mediaIdAliases(mediaId).some((id) => active.has(id))) element.pause();
        }
        emit(plan.timelineTimeUs / 1_000_000, playing);
      },
      pause() { for (const element of videos.values()) element.pause(); },
      dispose() { for (const element of videos.values()) element.pause(); videos.clear(); },
    },
    audioSink: createWebAudioGraphBackendV3({
      resolveSource(source) { return runtime?.mediaCatalog.assets.some((asset) => asset.mediaId === source.mediaId && asset.audio?.some((stream) => stream.streamId === source.streamId)) ?? false; },
      createElement(_clipId, source) {
        const stream = runtime?.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.audio?.find((candidate) => candidate.streamId === source.streamId);
        // Set CORS mode before assigning src or MediaElementAudioSourceNode
        // will be forced into opaque/silent mode by the browser.
        const element = new Audio();
        element.crossOrigin = "anonymous";
        element.src = stream?.resource.uri ?? "";
        element.preload = "auto";
        element.load();
        return element;
      },
    }),
  });
  // Backend confirmations can change effective transport state without a
  // user command or RAF tick; forward engine snapshots to UI sinks.
  const unsubscribeEngine = engine.subscribe((snapshot) => {
    if (!runtime) return;
    emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
  });
  const safeTime = (time: number): number => Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
  return {
    loadDocument(document, currentTime) {
      if (disposed) return;
      const compiled = compileProtocol(document);
      const wasLoaded = runtime !== undefined;
      const priorTimeUs = engine.snapshot().timeUs;
      runtime = compiled;
      documentGeneration += 1;
      duration = Math.max(0, compiled.visual.composition.duration ?? 0, ...compiled.visual.nodes.map((node) => node.timing.start + node.timing.duration), ...compiled.audioTimeline.tracks.flatMap((track) => track.clips.map((clip) => (clip.timelineStartSample + clip.timelineDurationSamples) / compiled.audioTimeline.sampleRate)));
      if (!wasLoaded) {
        seekRequestId += 1;
        engine.load(compiled);
        engine.seek(safeTime(currentTime) * 1_000_000);
        return;
      }
      // Document changes (including enabled=false) only replace runtime plans.
      // The PlaybackEngine remains the sole owner of time and play/pause.
      engine.updateProject(compiled);
      if (priorTimeUs > duration * 1_000_000) {
        seekRequestId += 1;
        engine.seek(duration * 1_000_000);
      }
    },
    play() {
      if (disposed) return;
      engine.play();
      const snapshot = engine.snapshot();
      emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
    },
    pause() {
      if (disposed) return;
      engine.pause();
      const snapshot = engine.snapshot();
      emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
    },
    toggle() {
      if (disposed) return;
      if (engine.snapshot().state === "playing") engine.pause(); else engine.play();
      const snapshot = engine.snapshot();
      emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
    },
    seek(time) { if (!disposed) { seekRequestId += 1; engine.seek(safeTime(time) * 1_000_000); } },
    previewAt(time) { if (!disposed) { seekRequestId += 1; engine.seek(safeTime(time) * 1_000_000); } },
    registerFrameSink(sink) { frames.add(sink); if (lastFrame) { const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: lastFrame.time, playing: snapshot.state === "playing", frame: lastFrame }); } return () => frames.delete(sink); },
    registerTimeSink(sink) { times.add(sink); const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: snapshot.timeUs / 1_000_000, playing: snapshot.state === "playing" }); return () => times.delete(sink); },
    setHiddenLayerIds() { /* visibility is applied by Stage from editor-session state. */ },
    registerVideo(assetId, element, onFrameReady) {
      for (const id of mediaIdAliases(assetId)) videos.set(id, element);
      const callback = () => onFrameReady?.();
      element.addEventListener("loadeddata", callback);
      // Resource preparation is asynchronous. The Stage can register its
      // element after the controller's initial seek has already published;
      // replay the current plan so the first mount does not require F5.
      if (runtime) engine.seek(engine.snapshot().timeUs);
      return () => {
        for (const id of mediaIdAliases(assetId)) {
          if (videos.get(id) === element) videos.delete(id);
        }
        element.removeEventListener("loadeddata", callback);
        element.pause();
      };
    },
    get playing() { return engine.snapshot().state === "playing"; },
    get duration() { return duration; },
    snapshot: () => engine.snapshot(),
    dispose() { if (disposed) return; disposed = true; unsubscribeEngine(); engine.dispose(); frames.clear(); times.clear(); runtime = undefined; },
  };
}
