import { createEditorRuntimeSession } from "@motionvideo/editor-runtime";
import { createAnimationFrameSchedulerV3, createDriftControllerV3, createPlaybackEngine, createWebAudioGraphBackendV3, requestMediaElementPlayV3, type PlaybackEngine, type PlaybackEngineSnapshot } from "@motionvideo/playback-engine";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { RuntimeFrameV3, RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type PlaybackOperationTokenV3 = { documentGeneration: number; transportGeneration: number; seekRequestId: number; generation: number };
export type PlaybackFrameEventV3 = PlaybackOperationTokenV3 & { time: number; frame: RuntimeFrameV3; playing: boolean };
export type PlaybackTimeEventV3 = PlaybackOperationTokenV3 & { time: number; playing: boolean; duration: number; ended: boolean };
export type PlaybackControllerV3 = {
  loadDocument(document: MotionProtocolV2, currentTime: number): RuntimeProjectV3;
  setPreviewDocument(document: MotionProtocolV2 | null): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  previewAt(time: number): void;
  registerFrameSink(sink: (event: PlaybackFrameEventV3) => void): () => void;
  registerTimeSink(sink: (event: PlaybackTimeEventV3) => void): () => void;
  setHiddenLayerIds(layerIds: readonly string[]): void;
  setPreparedRuntimeProject(project: RuntimeProjectV3): void;
  runtimeProject(): RuntimeProjectV3 | undefined;
  runtimeGeneration(): number;
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
  const runtimeSession = createEditorRuntimeSession();
  let disposed = false;
  let documentGeneration = 0;
  let seekRequestId = 0;
  let lastFrame: RuntimeFrameV3 | undefined;
  let lastEmitKey: string | undefined;
  let previewRuntime: RuntimeProjectV3 | undefined;
  const videos = new Map<string, HTMLVideoElement>();
  const driftController = createDriftControllerV3();
  const frames = new Set<(event: PlaybackFrameEventV3) => void>();
  const times = new Set<(event: PlaybackTimeEventV3) => void>();
  const scheduler = createAnimationFrameSchedulerV3(window);
  const emit = (time: number, playing: boolean): void => {
    if (!runtimeSession.current()) return;
    const snapshot = engine.snapshot();
    const token = { documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation };
    const duration = snapshot.durationUs / 1_000_000;
    // The engine publishes the last renderable plan before entering `ended`.
    // Reuse that frame instead of reconstructing an end time in the web layer.
    const frameTime = snapshot.state === "ended" ? lastFrame?.time ?? time : time;
    // A video-plan publish and the engine snapshot notification can describe
    // the same tick. Do not evaluate and paint that exact frame twice: the
    // second pass only adds main-thread work and makes Skia/browser preview
    // playback look stuttery on complex compositions.
    const emitKey = [
      documentGeneration,
      runtimeSession.generation(),
      snapshot.generation,
      seekRequestId,
      frameTime,
      playing,
      previewRuntime ? "preview" : "canonical",
    ].join(":");
    if (emitKey === lastEmitKey) return;
    lastEmitKey = emitKey;
    const frame = runtimeSession.evaluate(frameTime, previewRuntime ?? runtimeSession.current());
    if (!frame) return;
    lastFrame = frame;
    for (const sink of frames) sink({ ...token, time: frameTime, playing, frame });
    for (const sink of times) sink({ ...token, time, playing, duration, ended: snapshot.state === "ended" });
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
      resolveSource(source) { return runtimeSession.current()?.mediaCatalog.assets.some((asset) => asset.mediaId === source.mediaId && asset.audio?.some((stream) => stream.streamId === source.streamId)) ?? false; },
      createElement(_clipId, source) {
        const stream = runtimeSession.current()?.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.audio?.find((candidate) => candidate.streamId === source.streamId);
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
    if (!runtimeSession.current()) return;
    emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
  });
  return {
    loadDocument(document, currentTime) {
      if (disposed) throw new Error("Playback controller is disposed");
      const wasLoaded = runtimeSession.current() !== undefined;
      const compiled = runtimeSession.update(document);
      previewRuntime = undefined;
      documentGeneration += 1;
      if (!wasLoaded) {
        seekRequestId += 1;
        engine.load(compiled);
        engine.seek(currentTime * 1_000_000);
        return compiled;
      }
      // Document changes (including enabled=false) only replace runtime plans.
      // The PlaybackEngine remains the sole owner of time and play/pause.
      engine.updateProject(compiled);
      return compiled;
    },
    setPreviewDocument(document) {
      if (disposed) return;
      previewRuntime = document ? runtimeSession.preview(document) : undefined;
      const snapshot = engine.snapshot();
      emit(snapshot.timeUs / 1_000_000, snapshot.state === "playing");
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
    seek(time) { if (!disposed) { seekRequestId += 1; engine.seek(time * 1_000_000); } },
    previewAt(time) { if (!disposed) { seekRequestId += 1; engine.seek(time * 1_000_000); } },
    registerFrameSink(sink) { frames.add(sink); if (lastFrame) { const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: lastFrame.time, playing: snapshot.state === "playing", frame: lastFrame }); } return () => frames.delete(sink); },
    registerTimeSink(sink) { times.add(sink); const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: snapshot.timeUs / 1_000_000, playing: snapshot.state === "playing", duration: snapshot.durationUs / 1_000_000, ended: snapshot.state === "ended" }); return () => times.delete(sink); },
    setHiddenLayerIds() { /* visibility is applied by Stage from editor-session state. */ },
    setPreparedRuntimeProject(project) {
      if (disposed || !runtimeSession.current()) return;
      runtimeSession.replaceRuntime(project);
      engine.updateProject(project);
    },
    runtimeProject: () => runtimeSession.current(),
    runtimeGeneration: () => runtimeSession.generation(),
    registerVideo(assetId, element, onFrameReady) {
      for (const id of mediaIdAliases(assetId)) videos.set(id, element);
      const callback = () => onFrameReady?.();
      element.addEventListener("loadeddata", callback);
      // Resource preparation is asynchronous. The Stage can register its
      // element after the controller's initial seek has already published;
      // replay the current plan so the first mount does not require F5.
      if (runtimeSession.current()) engine.seek(engine.snapshot().timeUs);
      return () => {
        for (const id of mediaIdAliases(assetId)) {
          if (videos.get(id) === element) videos.delete(id);
        }
        element.removeEventListener("loadeddata", callback);
        element.pause();
      };
    },
    get playing() { return engine.snapshot().state === "playing"; },
    get duration() { return engine.snapshot().durationUs / 1_000_000; },
    snapshot: () => engine.snapshot(),
    dispose() { if (disposed) return; disposed = true; previewRuntime = undefined; unsubscribeEngine(); engine.dispose(); frames.clear(); times.clear(); runtimeSession.dispose(); },
  };
}
