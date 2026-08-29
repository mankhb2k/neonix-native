import { compileProtocol } from "@motionvideo/motion-compiler";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { evaluateRuntimeProjectV3, frameIndexAtTime, type RuntimeFrameV3, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { createAnimationFrameSchedulerV3, createPlaybackEngineNext, createWebAudioGraphBackendV3, requestMediaElementPlayV3, type PlaybackEngineNext, type PlaybackEngineNextSnapshot } from "@motionvideo/playback-engine-next";

export type PlaybackOperationTokenV3 = { documentGeneration: number; transportGeneration: number; seekRequestId: number; generation: number };
export type PlaybackFrameEventV3 = PlaybackOperationTokenV3 & { time: number; frame: RuntimeFrameV3; playing: boolean };
export type PlaybackTimeEventV3 = PlaybackOperationTokenV3 & { time: number; playing: boolean };
export type PlaybackControllerNextV3 = {
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
  snapshot(): PlaybackEngineNextSnapshot;
  dispose(): void;
};

/** Editor transport uses the canonical compiler/runtime; rendering remains a Stage concern. */
export function createPlaybackControllerNextV3(): PlaybackControllerNextV3 {
  let runtime: RuntimeProjectV3 | undefined;
  let disposed = false;
  let documentGeneration = 0;
  let seekRequestId = 0;
  let duration = 0;
  let lastFrame: RuntimeFrameV3 | undefined;
  const videos = new Map<string, HTMLVideoElement>();
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
  const engine: PlaybackEngineNext = createPlaybackEngineNext({
    scheduler,
    videoSink: {
      publish(plan) {
        const playing = engine.snapshot().state === "playing";
        const active = new Set<string>();
        for (const request of plan.instances) {
          active.add(request.source.mediaId);
          const element = videos.get(request.source.mediaId);
          if (!element) continue;
          const target = request.mediaTimeUs / 1_000_000;
          if (Math.abs(element.currentTime - target) > 0.05) element.currentTime = target;
          element.muted = true;
          if (playing) requestMediaElementPlayV3(element, "video"); else element.pause();
        }
        for (const [mediaId, element] of videos) if (!active.has(mediaId)) element.pause();
        emit(plan.timelineTimeUs / 1_000_000, playing);
      },
      pause() { for (const element of videos.values()) element.pause(); },
      dispose() { for (const element of videos.values()) element.pause(); videos.clear(); },
    },
    audioSink: createWebAudioGraphBackendV3({
      resolveSource(source) { return runtime?.mediaCatalog.assets.some((asset) => asset.mediaId === source.mediaId && asset.audio?.some((stream) => stream.streamId === source.streamId)) ?? false; },
      createElement(_clipId, source) {
        const stream = runtime?.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.audio?.find((candidate) => candidate.streamId === source.streamId);
        const element = new Audio(stream?.resource.uri ?? "");
        element.preload = "auto";
        return element;
      },
    }),
  });
  const safeTime = (time: number): number => Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
  return {
    loadDocument(document, currentTime) {
      if (disposed) return;
      const compiled = compileProtocol(document);
      runtime = compiled;
      documentGeneration += 1;
      seekRequestId += 1;
      duration = Math.max(0, compiled.visual.composition.duration ?? 0, ...compiled.visual.nodes.map((node) => node.timing.start + node.timing.duration), ...compiled.audioTimeline.tracks.flatMap((track) => track.clips.map((clip) => (clip.timelineStartSample + clip.timelineDurationSamples) / compiled.audioTimeline.sampleRate)));
      engine.load(compiled);
      engine.seek(safeTime(currentTime) * 1_000_000);
    },
    play() { if (!disposed) engine.play(); },
    pause() { if (!disposed) engine.pause(); },
    toggle() { if (engine.snapshot().state === "playing") engine.pause(); else engine.play(); },
    seek(time) { if (!disposed) { seekRequestId += 1; engine.seek(safeTime(time) * 1_000_000); } },
    previewAt(time) { if (!disposed) { seekRequestId += 1; engine.seek(safeTime(time) * 1_000_000); } },
    registerFrameSink(sink) { frames.add(sink); if (lastFrame) { const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: lastFrame.time, playing: snapshot.state === "playing", frame: lastFrame }); } return () => frames.delete(sink); },
    registerTimeSink(sink) { times.add(sink); const snapshot = engine.snapshot(); sink({ documentGeneration, transportGeneration: snapshot.generation, seekRequestId, generation: snapshot.generation, time: snapshot.timeUs / 1_000_000, playing: snapshot.state === "playing" }); return () => times.delete(sink); },
    setHiddenLayerIds() { /* visibility is applied by Stage from editor-session state. */ },
    registerVideo(assetId, element, onFrameReady) {
      videos.set(assetId, element);
      const callback = () => onFrameReady?.();
      element.addEventListener("loadeddata", callback);
      return () => {
        if (videos.get(assetId) === element) videos.delete(assetId);
        element.removeEventListener("loadeddata", callback);
        element.pause();
      };
    },
    get playing() { return engine.snapshot().state === "playing"; },
    get duration() { return duration; },
    snapshot: () => engine.snapshot(),
    dispose() { if (disposed) return; disposed = true; engine.dispose(); frames.clear(); times.clear(); runtime = undefined; },
  };
}
