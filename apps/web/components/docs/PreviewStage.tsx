"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { samplePreviewProtocolAtTime } from "@/lib/docs/preview-animation";
import { createCanvasKitTextAtlasRasterizer } from "@/lib/editor/playback/canvaskit-text-rasterizer";
import {
  PreviewResourceRegistry,
  previewResourceKey,
  type PreviewResourceLease,
} from "@/lib/editor/playback/preview-resource-registry";
import { applyStagePreviewOverrides } from "@/lib/editor/playback/runtime-preview";
import {
  stageInteractionStore,
  useStagePreviewOverrides,
  type StagePreviewOverrides,
} from "@/lib/store/stage-interaction-store";
import { compileProtocol, compileProtocolAtTime } from "@motionvideo/motion-compiler";
import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import {
  evaluateRuntimeProjectV3,
  frameIndexAtTime,
  prepareRuntimeProjectV3Text,
  type RuntimeFrameV3,
  type RuntimeProjectV3,
  type RuntimeTextShaperLoaderV3,
} from "@motionvideo/motion-runtime";
import {
  createPreviewRenderer,
  type PreviewAsset,
  type PreviewBackendKind,
  type PreviewBackendPreference,
} from "@motionvideo/preview-renderer";
import { createSkiaRenderer, skiaTextGlyphAssetId } from "@motionvideo/skia-renderer";
import type { PlaybackFrameEventV3 } from "@/lib/editor/playback/playback-controller-v3";

type PreviewStageProps = {
  project: unknown;
  hiddenLayerIds?: readonly string[];
  time?: number;
  frame?: RuntimeFrameV3;
  isPlaying?: boolean;
  /** Editor mode uses the shared playback controller. */
  externalPlayback?: boolean;
  /** Imperative frame path used by editor mode; avoids React state per RAF. */
  registerPlaybackFrameSink?: (sink: (event: PlaybackFrameEventV3) => void) => () => void;
  backend?: PreviewStageBackendPreference;
  onBackendReady?: (backend: PreviewStageBackendKind | null) => void;
  /** Keep the WebGL backbuffer only for capture/test scenarios. */
  preserveDrawingBuffer?: boolean;
  /** Stable identifier for diagnostic pages with more than one renderer. */
  testId?: string;
  /** Exposes the exact prepared RuntimeFrameV3 painted by the backend. */
  onFrameReady?: (frame: RuntimeFrameV3) => void;
  onVideoElement?: (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ) => void | (() => void);
};

type PreviewStageBackendKind = PreviewBackendKind | "skia";
type PreviewStageBackendPreference = PreviewBackendPreference | "skia";

type StageRenderer = {
  readonly backend: PreviewStageBackendKind;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  paintFrame(frame: RuntimeFrameV3): void;
  resize(width: number, height: number, devicePixelRatio?: number): void;
  setAsset(assetId: string, asset: PreviewAsset): void;
  removeAsset(assetId: string): void;
  setFont?(fontAssetId: string, font: ArrayBuffer | Uint8Array): void;
  removeFont?(fontAssetId: string): void;
  getStats(): {
    drawCalls: number;
    skippedCommands?: number;
    frameTimeMs: number;
    nativeTextGlyphs?: number;
    nativeColorTextGlyphs?: number;
    outlineTextGlyphs?: number;
    colorTextGlyphs?: number;
    textureUploads?: number;
    videoTextureUploads?: number;
    imageCacheHits?: number;
    filterCacheHits?: number;
    maskCacheHits?: number;
    projectiveMeshCacheHits?: number;
    offscreenSurfaceCreates?: number;
    offscreenSurfaceReuses?: number;
    imageCacheEntries?: number;
    filterCacheEntries?: number;
    maskCacheEntries?: number;
    projectiveMeshCacheEntries?: number;
    pooledSurfaceCount?: number;
    estimatedCacheBytes?: number;
    diagnostics: readonly { code: string }[];
  };
  dispose(): void;
};

/** Compile the current V2 sample while retaining the prepared text layout. */
function runtimeAtPreviewTime(
  project: MotionProtocolV2,
  runtime: RuntimeProjectV3,
  time: number,
): RuntimeProjectV3 {
  const sampledProject = samplePreviewProtocolAtTime(project, time);
  if (sampledProject === project) return runtime;
  const sampled = compileProtocol(sampledProject);
  return {
    ...sampled,
    visual: {
      ...sampled.visual,
      nodes: sampled.visual.nodes.map((node) => {
        const preparedNode = runtime.visual.nodes.find((candidate) => candidate.id === node.id);
        if (node.content.kind !== "text" || preparedNode?.content.kind !== "text") return node;
        return {
          ...node,
          content: {
            ...node.content,
            layout: preparedNode.content.layout,
          },
        };
      }),
    },
  };
}

/**
 * Resource/text preparation inputs, excluding properties that can be changed
 * by a stage transform. A move must recompile the runtime, but it must not
 * tear down decoded media or prepared text for the whole composition.
 */
function previewPreparationFingerprint(project: MotionProtocolV2 | null): string | null {
  if (!project) return null;
  return JSON.stringify({
    projectId: project.id,
    composition: project.composition,
    assets: project.assets ?? [],
    audio: project.audio,
    layers: project.layers.map((layer) => {
      const { transform: _transform, timing: _timing, frame, tracks, ...staticLayer } = layer;
      const nonGeometryTracks = tracks?.filter(
        (track) =>
          !track.path.startsWith("transform.") &&
          !track.path.startsWith("frame.") &&
          track.path !== "opacity",
      );
      return {
        ...staticLayer,
        ...(layer.type === "text" ? { frame } : {}),
        ...(nonGeometryTracks && nonGeometryTracks.length > 0
          ? { tracks: nonGeometryTracks }
          : {}),
      };
    }),
  });
}

/** Keep prepared glyph/layout data while replacing runtime transforms/tracks. */
function reusePreparedTextContent(
  compiled: RuntimeProjectV3,
  previous: RuntimeProjectV3,
): RuntimeProjectV3 {
  const previousById = new Map(previous.visual.nodes.map((node) => [node.id, node]));
  return {
    ...compiled,
    visual: {
      ...compiled.visual,
      nodes: compiled.visual.nodes.map((node) => {
        const previousNode = previousById.get(node.id);
        if (node.content.kind !== "text" || previousNode?.content.kind !== "text") return node;
        return { ...node, content: previousNode.content };
      }),
    },
  };
}

export function PreviewStage({
  project,
  hiddenLayerIds = [],
  time = 0,
  frame,
  isPlaying = false,
  externalPlayback = false,
  registerPlaybackFrameSink,
  backend = "skia",
  onBackendReady,
  preserveDrawingBuffer = false,
  testId = "preview-v2-canvas",
  onFrameReady,
  onVideoElement,
}: PreviewStageProps) {
  // `auto` is retained as a public compatibility preference for callers that
  // used the pre-Skia preview API. In the 2D MVP it must resolve to Skia; the
  // legacy GPU backends remain opt-in via an explicit preference.
  const effectiveBackend: PreviewStageBackendKind = backend === "auto" ? "skia" : backend;
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectRef = useRef<ReturnType<typeof MotionProtocolV2Schema.parse> | null>(null);
  const sourceProjectRef = useRef<unknown>(project);
  sourceProjectRef.current = project;
  const assetsRef = useRef<ReadonlyMap<string, PreviewAsset>>(new Map());
  const skiaTextAssetsRef = useRef<ReadonlyMap<string, PreviewAsset>>(new Map());
  const skiaFontBytesRef = useRef<ReadonlyMap<string, ArrayBuffer>>(new Map());
  const resourcesRef = useRef<PreviewResources | null>(null);
  const resourceRegistryRef = useRef<PreviewResourceRegistry | null>(null);
  if (!resourceRegistryRef.current) resourceRegistryRef.current = new PreviewResourceRegistry();
  const resourceRegistry = resourceRegistryRef.current;
  const resourceRegistryDisposeRef = useRef<number | null>(null);
  const runtimeRef = useRef<RuntimeProjectV3 | null>(null);
  const preparedFingerprintRef = useRef<string | null>(null);
  const preparationDiagnosticsRef = useRef<string[]>([]);
  const onBackendReadyRef = useRef(onBackendReady);
  const onFrameReadyRef = useRef(onFrameReady);
  const onVideoElementRef = useRef(onVideoElement);
  const videoRegistrationDisposersRef = useRef<Array<() => void>>([]);
  const playbackFrameSinkReleaseRef = useRef<(() => void) | null>(null);
  const paintRequestRef = useRef(0);
  const playbackGenerationRef = useRef(-1);
  const resourceGenerationRef = useRef(0);
  const timeRef = useRef(time);
  const frameRef = useRef<RuntimeFrameV3 | null>(frame ?? null);
  const isPlayingRef = useRef(isPlaying);
  // The canvas is created imperatively. Track its availability so the
  // compilation effect cannot miss it on the initial React effect pass.
  const [canvasReadyToken, setCanvasReadyToken] = useState(0);
  const [resourceReadyToken, setResourceReadyToken] = useState(0);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const previewOverrides = useStagePreviewOverrides();
  const previewOverridesRef = useRef<StagePreviewOverrides>(previewOverrides);
  previewOverridesRef.current = previewOverrides;
  onBackendReadyRef.current = onBackendReady;
  onFrameReadyRef.current = onFrameReady;
  onVideoElementRef.current = onVideoElement;
  const renderProject = useMemo(() => {
    if (hiddenLayerIds.length === 0 || !project || typeof project !== "object") {
      return project;
    }
    const candidate = project as { layers?: unknown };
    if (!Array.isArray(candidate.layers)) return project;
    const hidden = new Set(hiddenLayerIds);
    const source = project as MotionProtocolV2;
    const isHidden = (layer: MotionProtocolV2["layers"][number]): boolean => {
      if (hidden.has(layer.id)) return true;
      let parentId = layer.parentLayerId;
      while (parentId != null) {
        if (hidden.has(parentId)) return true;
        parentId = source.layers.find((parent) => parent.id === parentId)?.parentLayerId ?? null;
      }
      return false;
    };
    const layers = source.layers.filter((layer) => !isHidden(layer));
    return { ...source, layers };
  }, [hiddenLayerIds, project]);
  const parsedResult = useMemo(
    () => MotionProtocolV2Schema.safeParse(renderProject),
    [renderProject],
  );
  const parsedProject = parsedResult.success ? parsedResult.data : null;
  const preparationFingerprint = useMemo(
    () => previewPreparationFingerprint(parsedProject),
    [parsedProject],
  );
  // Keep synchronous frame effects from pairing a newly selected project with
  // the previous project's prepared RuntimeProject while resource loading is
  // still in flight.
  if (projectRef.current !== parsedProject) {
    projectRef.current = parsedProject;
    // A RuntimeFrame belongs to the previous document. Never let a static
    // frame override win the first paint after a transform command.
    frameRef.current = null;
    if (preparationFingerprint !== preparedFingerprintRef.current) {
      runtimeRef.current = null;
      preparationDiagnosticsRef.current = [];
    }
  }
  const error = parsedResult.success ? rendererError : parsedResult.error.message;
  frameRef.current = frame ?? null;
  isPlayingRef.current = isPlaying;

  const handleDecodedVideoFrame = useCallback((assetId: string, element: HTMLVideoElement) => {
    const asset = assetsRef.current.get(assetId);
    if (!asset || asset.source !== element) return;
    asset.frameVersion = (asset.frameVersion ?? 0) + 1;
    // During playback the composition RAF remains the paint clock. A decoded
    // callback only needs to wake a paused seek so the target reaches texture.
    if (isPlayingRef.current) return;
    const renderer = rendererRef.current;
    const parsed = projectRef.current;
    if (!renderer || !parsed) return;
    const requestId = ++paintRequestRef.current;
    void paintFrame(
      renderer,
      parsed,
      timeRef.current,
      requestId,
      paintRequestRef,
      frameRef.current,
      runtimeRef.current,
      assetsRef.current,
      false,
      preparationDiagnosticsRef.current,
      onFrameReadyRef.current,
      previewOverridesRef.current,
    );
  }, []);

  useEffect(() => {
    if (externalPlayback) return undefined;
    timeRef.current = time;
    const renderer = rendererRef.current;
    const parsed = projectRef.current;
    if (!renderer || !parsed) return undefined;
    const requestId = ++paintRequestRef.current;
    void paintFrame(
      renderer,
      parsed,
      time,
      requestId,
      paintRequestRef,
      frameRef.current,
      runtimeRef.current,
      assetsRef.current,
      isPlayingRef.current,
      preparationDiagnosticsRef.current,
      onFrameReadyRef.current,
      previewOverridesRef.current,
    );
    return undefined;
  }, [externalPlayback, frame, isPlaying, time]);

  useEffect(() => {
    if (
      !externalPlayback ||
      !registerPlaybackFrameSink ||
      !rendererRef.current ||
      !runtimeRef.current ||
      playbackFrameSinkReleaseRef.current
    ) return undefined;
    const release = registerPlaybackFrameSink((event) => {
      if (event.generation < playbackGenerationRef.current) return;
      playbackGenerationRef.current = event.generation;
      timeRef.current = event.time;
      isPlayingRef.current = event.playing;
      frameRef.current = event.frame;
      const renderer = rendererRef.current;
      const parsed = projectRef.current;
      if (!renderer || !parsed) return;
      const requestId = ++paintRequestRef.current;
      const sourceProject = sourceProjectRef.current;
      const commitPending = stageInteractionStore.isCommitPendingFor(sourceProject) && Boolean(runtimeRef.current);
      paintFrame(
        renderer,
        parsed,
        event.time,
        requestId,
        paintRequestRef,
        event.frame,
        runtimeRef.current,
        assetsRef.current,
        event.playing,
        preparationDiagnosticsRef.current,
        onFrameReadyRef.current,
        commitPending ? new Map() : previewOverridesRef.current,
      );
      if (commitPending) stageInteractionStore.acknowledgeCommit(sourceProject);
    });
    playbackFrameSinkReleaseRef.current = release;
    return () => {
      release();
      if (playbackFrameSinkReleaseRef.current === release) {
        playbackFrameSinkReleaseRef.current = null;
      }
    };
  }, [externalPlayback, registerPlaybackFrameSink, resourceReadyToken]);

  // The canvas and renderer live for the lifetime of the selected backend. Keeping
  // them mounted while the document changes prevents a visible blank frame
  // when a layer is added from the editor header.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    onBackendReadyRef.current?.(null);
    const canvas = document.createElement("canvas");
    canvas.dataset.testid = testId;
    canvas.style.position = "absolute";
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transformOrigin = "center center";
    host.replaceChildren(canvas);
    host.style.position = "relative";
    canvasRef.current = canvas;
    setCanvasReadyToken((value) => value + 1);

    return () => {
      playbackFrameSinkReleaseRef.current?.();
      playbackFrameSinkReleaseRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      onBackendReadyRef.current?.(null);
      projectRef.current = null;
      resourcesRef.current?.release();
      resourcesRef.current = null;
      assetsRef.current = new Map();
      releaseSkiaTextAssets(skiaTextAssetsRef.current);
      skiaTextAssetsRef.current = new Map();
      skiaFontBytesRef.current = new Map();
      runtimeRef.current = null;
      for (const dispose of videoRegistrationDisposersRef.current) dispose();
      videoRegistrationDisposersRef.current = [];
      preparationDiagnosticsRef.current = [];
      canvasRef.current = null;
      canvas.remove();
    };
  }, [effectiveBackend, testId]);

  useEffect(() => {
    // React Strict Mode performs an effect cleanup followed by a setup during
    // development. Do not dispose the registry synchronously in that probe:
    // the ref survives the probe and would otherwise keep a disposed registry
    // for the real resource-loading effect. A macrotask still disposes it on a
    // genuine unmount, while the next setup cancels the probe cleanup.
    if (resourceRegistryDisposeRef.current !== null) {
      window.clearTimeout(resourceRegistryDisposeRef.current);
      resourceRegistryDisposeRef.current = null;
    }
    return () => {
      resourceRegistryDisposeRef.current = window.setTimeout(() => {
        resourceRegistry.dispose();
        resourceRegistryDisposeRef.current = null;
      }, 0);
    };
  }, [resourceRegistry]);

  // Recompile and repaint the existing renderer for document edits. Resource
  // loading may be asynchronous, so the previous frame remains visible until
  // the new frame is ready instead of replacing the canvas with a blank one.
  useEffect(() => {
    const resourceProject = projectRef.current;
    if (!resourceProject) {
      projectRef.current = null;
      preparedFingerprintRef.current = null;
      return undefined;
    }

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    canvas.dataset.previewState = "loading-resources";
    let cancelled = false;
    const resourceGeneration = ++resourceGenerationRef.current;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const initialRenderDpr = canvasRenderDpr(host, resourceProject.composition.width, resourceProject.composition.height, devicePixelRatio, effectiveBackend);
    // Do not let a prepared RuntimeProject from the previous dropdown/project
    // selection paint while the new font resources are being resolved.
    runtimeRef.current = null;
    let rendererCreationStarted = false;

    void (async () => {
      const resources = await loadPreviewResources(resourceProject, resourceRegistry, resourceGeneration);
      if (cancelled || resourceGeneration !== resourceGenerationRef.current) {
        resources.release();
        return;
      }
      // A geometry edit may have landed while resources were preparing. The
      // resource lease is still valid, but the compiled runtime must use the
      // latest canonical project rather than the effect's old closure.
      const activeProject = projectRef.current ?? resourceProject;
      const previousAssets = assetsRef.current;
      const previousSkiaTextAssets = skiaTextAssetsRef.current;
      const previousSkiaFontBytes = skiaFontBytesRef.current;
      const previousResources = resourcesRef.current;
      const compiled = compileProtocol(activeProject);
      canvas.dataset.previewState = "compiling";
      const initialFrame = evaluateRuntimeProjectV3(
        compiled,
        frameIndexAtTime(timeRef.current, activeProject.composition.fps),
        { time: timeRef.current },
      );
      await prepareVideoFrames(initialFrame, resources.assets);
      const prepared = compiled.visual.nodes.some((node) => node.content.kind === "text")
        ? await prepareRuntimeProjectV3Text(
            compiled,
            (font) => Promise.resolve(resources.fontBytes.get(font.assetId) ?? null),
          loadBrowserHarfBuzz,
        )
        : null;
      const textAtlasRasterizer = effectiveBackend !== "skia" && compiled.visual.nodes.some((node) => node.content.kind === "text")
        ? await createCanvasKitTextAtlasRasterizer((assetId) => resources.fontBytes.get(assetId) ?? null).catch(() => undefined)
        : undefined;
      canvas.dataset.textRasterizer = textAtlasRasterizer ? "canvaskit" : "canvas2d";
      canvas.dataset.skiaTextAssets = "0";
      if (cancelled || resourceGeneration !== resourceGenerationRef.current) {
        resources.release();
        return;
      }
      const runtime = prepared?.project ?? compiled;
      const preparedFrame = evaluateRuntimeProjectV3(
        runtime,
        frameIndexAtTime(timeRef.current, activeProject.composition.fps),
        { time: timeRef.current },
      );
      const skiaTextAssets = effectiveBackend === "skia"
        ? await loadSkiaTextAssets(preparedFrame)
        : new Map<string, PreviewAsset>();
      canvas.dataset.skiaTextAssets = String(skiaTextAssets.size);
      if (cancelled || resourceGeneration !== resourceGenerationRef.current) {
        releaseSkiaTextAssets(skiaTextAssets);
        resources.release();
        return;
      }
      let renderer = rendererRef.current;
      const requestedTextRasterizer = effectiveBackend === "skia"
        ? "skia-glyphs"
        : textAtlasRasterizer
          ? "canvaskit"
          : "canvas2d";
      // The backend captures the atlas rasterizer when it is created. A docs
      // fixture can change from a non-text case to an emoji case without
      // remounting PreviewStage, so recreate the backend when that dependency
      // changes instead of leaving it with a stale Canvas2D fallback.
      if (renderer && canvas.dataset.rendererTextRasterizer !== requestedTextRasterizer) {
        renderer.dispose();
        rendererRef.current = null;
        renderer = null;
      }
      if (!renderer) {
        canvas.dataset.previewState = "creating-renderer";
        rendererCreationStarted = true;
        const nextRenderer = effectiveBackend === "skia"
          ? await createSkiaRenderer({
            canvas,
            width: activeProject.composition.width,
            height: activeProject.composition.height,
            devicePixelRatio: initialRenderDpr,
            assets: new Map([...resources.assets, ...skiaTextAssets]),
            fonts: resources.fontBytes,
          })
          : await createPreviewRenderer({
            canvas,
            backend: effectiveBackend,
            width: activeProject.composition.width,
            height: activeProject.composition.height,
            devicePixelRatio: initialRenderDpr,
            preserveDrawingBuffer,
            assets: resources.assets,
            textAtlasRasterizer,
          });
        if (cancelled || resourceGeneration !== resourceGenerationRef.current) {
          nextRenderer.dispose();
          releaseSkiaTextAssets(skiaTextAssets);
          resources.release();
          return;
        }
        renderer = nextRenderer;
        rendererRef.current = renderer;
        canvas.dataset.rendererDpr = String(initialRenderDpr);
        canvas.dataset.backend = renderer.backend;
        canvas.dataset.rendererTextRasterizer = requestedTextRasterizer;
        canvas.dataset.previewState = "ready";
        onBackendReadyRef.current?.(renderer.backend);
      } else {
        for (const assetId of previousAssets.keys()) renderer.removeAsset(assetId);
        for (const assetId of previousSkiaTextAssets.keys()) renderer.removeAsset(assetId);
        for (const [assetId, asset] of resources.assets) renderer.setAsset(assetId, asset);
        for (const [assetId, asset] of skiaTextAssets) renderer.setAsset(assetId, asset);
        for (const [fontAssetId, previousBytes] of previousSkiaFontBytes) {
          if (resources.fontBytes.get(fontAssetId) !== previousBytes) renderer.removeFont?.(fontAssetId);
        }
        for (const [fontAssetId, bytes] of resources.fontBytes) {
          if (previousSkiaFontBytes.get(fontAssetId) !== bytes) renderer.setFont?.(fontAssetId, bytes);
        }
      }
      if (!renderer) return;
      canvas.dataset.previewState = "ready";
      for (const dispose of videoRegistrationDisposersRef.current) dispose();
      videoRegistrationDisposersRef.current = [];
      assetsRef.current = resources.assets;
      skiaTextAssetsRef.current = skiaTextAssets;
      skiaFontBytesRef.current = resources.fontBytes;
      resourcesRef.current = resources;
      for (const [assetId, asset] of resources.assets) {
        if (asset.kind !== "video" || !(asset.source instanceof HTMLVideoElement)) continue;
        const dispose = onVideoElementRef.current?.(
          assetId,
          asset.source,
          () => handleDecodedVideoFrame(assetId, asset.source as HTMLVideoElement),
        );
        if (dispose) videoRegistrationDisposersRef.current.push(dispose);
      }
      const uniqueAssets = [...new Set(resources.assets.values())];
      canvas.dataset.previewResourceCounts = JSON.stringify({
        ...resourceRegistry.stats(),
        activeAssets: uniqueAssets.length,
        activeVideos: uniqueAssets.filter((asset) => asset.kind === "video").length,
        activeRvfcs: uniqueAssets.filter((asset) => asset.kind === "video").length,
        activeFonts: resources.fontBytes.size,
        cachedAudioBuffers: 0,
        activeAudioSources: 0,
      });
      previousResources?.release();
      releaseSkiaTextAssets(previousSkiaTextAssets);
      runtimeRef.current = runtime;
      setResourceReadyToken((value) => value + 1);
      preparationDiagnosticsRef.current = [
        ...resources.diagnostics,
        ...(prepared?.diagnostics.map((diagnostic) => diagnostic.code) ?? []),
      ];
      preparedFingerprintRef.current = preparationFingerprint;
      setRendererError(null);
      applyCanvasLayout(
        host,
        canvas,
        activeProject.composition.width,
        activeProject.composition.height,
        devicePixelRatio,
        initialRenderDpr,
      );
      if (!externalPlayback) {
        if (!renderer) return;
        const requestId = ++paintRequestRef.current;
        const sourceProject = sourceProjectRef.current;
        const commitPending = stageInteractionStore.isCommitPendingFor(sourceProject);
        void paintFrame(
          renderer,
          activeProject,
          timeRef.current,
          requestId,
          paintRequestRef,
          frameRef.current,
          runtimeRef.current,
          assetsRef.current,
          isPlayingRef.current,
          preparationDiagnosticsRef.current,
          onFrameReadyRef.current,
          commitPending ? new Map() : previewOverridesRef.current,
        );
        if (commitPending) stageInteractionStore.acknowledgeCommit(sourceProject);
      }
    })().catch((err: unknown) => {
      if (!cancelled && resourceGeneration === resourceGenerationRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.dataset.previewState = "error";
          // Backend startup failures are separate from replay failures. The
          // latter are retained as `skia_command_unsupported` diagnostics by
          // the renderer after it has successfully created a surface.
          canvas.dataset.diagnostics = rendererCreationStarted
            ? `${effectiveBackend}_backend_unavailable`
            : "preview_renderer_error";
          canvas.dataset.backendError = message;
        }
        setRendererError(message);
      }
    });

    return () => {
      cancelled = true;
      resourceGenerationRef.current += 1;
      paintRequestRef.current += 1;
      for (const dispose of videoRegistrationDisposersRef.current) dispose();
      videoRegistrationDisposersRef.current = [];
    };
  }, [effectiveBackend, canvasReadyToken, externalPlayback, handleDecodedVideoFrame, preparationFingerprint, preserveDrawingBuffer, resourceRegistry]);

  // Geometry-only document edits should update the compiled scene and repaint,
  // but must not restart resource loading or unregister existing media.
  useEffect(() => {
    if (
      !parsedProject ||
      preparationFingerprint === null ||
      preparedFingerprintRef.current !== preparationFingerprint ||
      !rendererRef.current ||
      !resourcesRef.current ||
      !runtimeRef.current
    ) return undefined;
    const compiled = compileProtocol(parsedProject);
    runtimeRef.current = reusePreparedTextContent(compiled, runtimeRef.current);
    const requestId = ++paintRequestRef.current;
    const sourceProject = sourceProjectRef.current;
    const commitPending = stageInteractionStore.isCommitPendingFor(sourceProject);
    void paintFrame(
      rendererRef.current,
      parsedProject,
      timeRef.current,
      requestId,
      paintRequestRef,
      null,
      runtimeRef.current,
      assetsRef.current,
      isPlayingRef.current,
      preparationDiagnosticsRef.current,
      onFrameReadyRef.current,
      commitPending ? new Map() : previewOverridesRef.current,
    );
    if (commitPending) stageInteractionStore.acknowledgeCommit(sourceProject);
    return undefined;
  }, [parsedProject, preparationFingerprint]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const parsed = projectRef.current;
    if (!host || !canvas || !parsed) return undefined;
    const update = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const renderer = rendererRef.current;
      const renderDpr = canvasRenderDpr(host, parsed.composition.width, parsed.composition.height, devicePixelRatio, effectiveBackend);
      applyCanvasLayout(
        host,
        canvas,
        parsed.composition.width,
        parsed.composition.height,
        devicePixelRatio,
        renderDpr,
      );
      if (
        renderer &&
        Math.abs(Number(canvas.dataset.rendererDpr) - renderDpr) > 0.0001
      ) {
        renderer.resize(
          parsed.composition.width,
          parsed.composition.height,
          renderDpr,
        );
        canvas.dataset.rendererDpr = String(renderDpr);
        const requestId = ++paintRequestRef.current;
        void paintFrame(
          renderer,
          parsed,
          timeRef.current,
          requestId,
          paintRequestRef,
          frameRef.current,
          runtimeRef.current,
          assetsRef.current,
          isPlayingRef.current,
          preparationDiagnosticsRef.current,
          onFrameReadyRef.current,
          previewOverridesRef.current,
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [effectiveBackend, parsedProject]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const parsed = projectRef.current;
    if (!renderer || !parsed) return undefined;
    const requestId = ++paintRequestRef.current;
    void paintFrame(
      renderer,
      parsed,
      timeRef.current,
      requestId,
      paintRequestRef,
      frameRef.current,
      runtimeRef.current,
      assetsRef.current,
      isPlayingRef.current,
      preparationDiagnosticsRef.current,
      onFrameReadyRef.current,
      previewOverrides,
    );
    return undefined;
  }, [previewOverrides]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden bg-black"
      data-testid="preview-v2-stage"
    >
      {error ? (
        <pre
          className="h-full overflow-auto p-4 text-[13px] text-red-300 whitespace-pre-wrap"
          data-testid="preview-v2-error"
        >
          {error}
        </pre>
      ) : null}
    </div>
  );
}

type PreviewResources = {
  assets: ReadonlyMap<string, PreviewAsset>;
  fontBytes: ReadonlyMap<string, ArrayBuffer>;
  diagnostics: string[];
  release: () => void;
};

async function loadPreviewResources(
  project: MotionProtocolV2,
  registry: PreviewResourceRegistry,
  resourceGeneration = 0,
): Promise<PreviewResources> {
  const loaded = new Map<string, PreviewAsset>();
  const fontBytes = new Map<string, ArrayBuffer>();
  const diagnostics: string[] = [];
  const leases: Array<PreviewResourceLease<unknown>> = [];
  for (const asset of project.assets ?? []) {
    try {
      if (asset.kind === "audio") continue;
      const key = previewResourceKey(asset);
      if (asset.kind === "font") {
        const lease = await registry.acquire(key, async () => {
          // Asset URLs are resolved at runtime and may point to any configured origin.
          // The bundled Noto Color Emoji font is intentionally large. Some
          // Chromium profiles fail with ERR_CACHE_WRITE_FAILURE while writing
          // it to the HTTP disk cache, even though the response is valid. The
          // preview registry already owns the in-memory lifetime, so avoid the
          // browser disk-cache write for deterministic font loading.
          const response = await globalThis.fetch(asset.uri, { cache: "no-store" });
          if (!response.ok) throw new Error(`Unable to load font asset ${asset.id}`);
          const bytes = await response.arrayBuffer();
          if (!(await matchesIntegrity(bytes, asset.integrity))) {
            throw new Error(`Font integrity mismatch for ${asset.id}`);
          }
          return bytes;
        });
        leases.push(lease);
        fontBytes.set(asset.id, lease.value);
        continue;
      }
      if (asset.kind === "video") {
        const lease = await registry.acquire(key, async () => {
          const video = document.createElement("video");
          video.crossOrigin = "anonymous";
          video.preload = "auto";
          video.playsInline = true;
          video.src = asset.uri;
          video.load();
          await waitForVideoReady(video);
          const width = asset.width ?? video.videoWidth;
          const height = asset.height ?? video.videoHeight;
          if (!width || !height) throw new Error(`Video asset ${asset.id} has no dimensions`);
          await seekVideo(video, 0);
          // Some browsers expose HAVE_CURRENT_DATA before the first decoded
          // frame is available to WebGPU's copyExternalImageToTexture. Prime
          // one frame while muted so the initial paused preview is not black.
          await primeVideoFrame(video);
          return {
            source: video,
            width,
            height,
            kind: "video" as const,
            frameVersion: 0,
            resourceGeneration,
            contentRevision: 1,
          } satisfies PreviewAsset;
        }, disposePreviewAsset);
      leases.push(lease);
      loaded.set(asset.id, lease.value);
      if (asset.id.startsWith("asset-")) loaded.set(asset.id.slice("asset-".length), lease.value);
      else loaded.set(`asset-${asset.id}`, lease.value);
      continue;
      }
      const lease = await registry.acquire(key, async () => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = asset.uri;
        await image.decode();
        const width = asset.width ?? image.naturalWidth;
        const height = asset.height ?? image.naturalHeight;
        const raster = document.createElement("canvas");
        raster.width = width;
        raster.height = height;
        const context = raster.getContext("2d");
        if (!context) throw new Error(`Unable to rasterize image asset ${asset.id}`);
        context.drawImage(image, 0, 0, width, height);
        const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
        return {
          source: raster,
          width,
          height,
          kind: "image" as const,
          pixels,
          resourceGeneration,
          contentRevision: 1,
        } satisfies PreviewAsset;
      });
      leases.push(lease);
      loaded.set(asset.id, lease.value);
    } catch {
      diagnostics.push(asset.kind === "font" ? "preview_font_unavailable" : "preview_asset_missing");
      // Keep the renderer alive so it can report the missing resource.
    }
  }
  let released = false;
  return {
    assets: loaded,
    fontBytes,
    diagnostics,
    release: () => {
      if (released) return;
      released = true;
      for (const lease of leases) lease.release();
    },
  };
}

function disposePreviewAsset(asset: PreviewAsset): void {
  if (!(asset.source instanceof HTMLVideoElement)) return;
  try {
    asset.source.pause();
    asset.source.removeAttribute("src");
    asset.source.load();
  } catch {
    // Best-effort decoder/network cleanup during registry eviction.
  }
}

function releaseSkiaTextAssets(assets: ReadonlyMap<string, PreviewAsset>): void {
  for (const asset of assets.values()) {
    if (typeof ImageBitmap !== "undefined" && asset.source instanceof ImageBitmap) asset.source.close();
  }
}

async function loadSkiaTextAssets(frame: RuntimeFrameV3): Promise<Map<string, PreviewAsset>> {
  const decoded = new Map<string, PreviewAsset>();
  const jobs: Array<Promise<void>> = [];
  for (const command of frame.commands) {
    if (command.op !== "drawText") continue;
    for (const [glyphIndex, glyph] of (command.glyphs ?? []).entries()) {
      const colorGlyph = glyph.colorGlyph;
      const bitmapGlyph = colorGlyph?.kind === "bitmap" ? colorGlyph : glyph.colorGlyphFallback;
      if (!bitmapGlyph) continue;
      jobs.push((async () => {
        let uri: string | undefined;
        try {
          const encoded = bitmapGlyph.bytes.slice().buffer;
          uri = URL.createObjectURL(new Blob([encoded], { type: bitmapGlyph.mimeType }));
          const source = new Image();
          source.decoding = "async";
          source.src = uri;
          await source.decode();
          decoded.set(skiaTextGlyphAssetId(command.key, glyphIndex), {
            source,
            width: source.naturalWidth,
            height: source.naturalHeight,
            kind: "image",
          });
        } catch {
          // The Skia replay keeps its outline fallback and reports a diagnostic
          // if this browser cannot decode the color glyph resource.
        } finally {
          if (uri) URL.revokeObjectURL(uri);
        }
      })());
    }
  }
  await Promise.all(jobs);
  return decoded;
}

async function matchesIntegrity(bytes: ArrayBuffer, integrity: string): Promise<boolean> {
  const expected = integrity.toLowerCase().replace(/^sha256:/, "");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return actual === expected;
}

function loadBrowserHarfBuzz(): ReturnType<RuntimeTextShaperLoaderV3> {
  // Deliberately opaque to webpack: this public ESM module imports its matching
  // WASM sibling and must not be inspected by Next SSR.
  const modulePath: string = "/vendor/harfbuzz/index.mjs";
  return import(/* webpackIgnore: true */ modulePath) as ReturnType<RuntimeTextShaperLoaderV3>;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Unable to load video asset ${video.src}`));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const videoElement = video;
  if (Math.abs(videoElement.currentTime - time) < 0.0005 && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      videoElement.removeEventListener("seeked", onSeeked);
      window.clearTimeout(timeout);
    };
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(onSeeked, 2000);
    videoElement.addEventListener("seeked", onSeeked, { once: true });
    videoElement.currentTime = Math.max(0, time);
  });
}

async function primeVideoFrame(video: HTMLVideoElement): Promise<void> {
  const target = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };
  if (typeof target.requestVideoFrameCallback !== "function") return;
  const videoElement = video;
  const wasPaused = videoElement.paused;
  let callbackHandle: number | undefined;
  try {
    const frameReady = new Promise<void>((resolve) => {
      const handle = target.requestVideoFrameCallback?.(() => {
        resolve();
      });
      callbackHandle = handle;
    });
    videoElement.muted = true;
    if (videoElement.paused) await videoElement.play();
    await Promise.race([
      frameReady,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1000);
      }),
    ]);
  } catch {
    // A browser may reject autoplay even for a muted detached element. The
    // regular loadeddata/seek path remains valid in that case.
  } finally {
    if (callbackHandle !== undefined) target.cancelVideoFrameCallback?.(callbackHandle);
    if (wasPaused) videoElement.pause();
  }
}

async function prepareVideoFrames(
  frame: RuntimeFrameV3,
  assets: ReadonlyMap<string, PreviewAsset>,
): Promise<void> {
  const targets = new Map<string, number>();
  for (const command of frame.commands) {
    if (command.op !== "drawVideo" || command.mediaVisible === false) continue;
    if (!targets.has(command.assetId)) targets.set(command.assetId, command.mediaTime);
  }
  await Promise.all([...targets].map(async ([assetId, mediaTime]) => {
    const asset = assets.get(assetId);
    if (!asset || asset.kind !== "video" || !(asset.source instanceof HTMLVideoElement)) return;
    await seekVideo(asset.source, mediaTime);
    await primeVideoFrame(asset.source);
  }));
}

function frameContainsPreparedText(
  candidate: RuntimeFrameV3,
): boolean {
  const textCommands = candidate.commands.filter((command) => command.op === "drawText");
  // Inactive text layers legitimately emit no drawText command. Validate only
  // the commands emitted for this frame; requiring glyphs for every text
  // layer prevents the editor from receiving the active layer's layout when
  // the composition contains timed text layers.
  if (textCommands.length === 0) return !candidate.diagnostics.some((diagnostic) => diagnostic.code === "runtime_v2_text_unprepared");
  return textCommands.every((command) => command.glyphs !== undefined);
}

function paintFrame(
  renderer: StageRenderer,
  project: ReturnType<typeof MotionProtocolV2Schema.parse>,
  time: number,
  requestId: number,
  requestRef: { current: number },
  frameOverride: RuntimeFrameV3 | null,
  runtimeOverride: RuntimeProjectV3 | null,
  assets: ReadonlyMap<string, PreviewAsset>,
  playing: boolean,
  preparationDiagnostics: readonly string[],
  onFrameReady?: (frame: RuntimeFrameV3) => void,
  previewOverrides: StagePreviewOverrides = new Map(),
): void {
  const collectPerformanceMetrics = process.env.NODE_ENV !== "production";
  const paintStartedAt = collectPerformanceMetrics ? performance.now() : 0;
  // The editor intentionally keeps the playhead at the exact timeline end.
  // Runtime activity windows are half-open ([start, end)), so sampling that
  // exact value would clear every layer. Resolve the final displayed sample
  // to the last real composition frame while leaving the playhead position
  // unchanged in the timeline UI.
  const renderTime = previewSampleTimeAtEnd(project, time);
  const frameIndex = frameIndexAtTime(renderTime, project.composition.fps);
  const projectHasAnimatedLayers = project.layers.some((layer) => (layer.tracks?.length ?? 0) > 0);
  const usableFrameOverride =
    frameOverride != null &&
    !projectHasAnimatedLayers &&
    Math.abs(frameOverride.time - renderTime) < 1e-6 &&
    frameContainsPreparedText(frameOverride)
      ? frameOverride
      : null;
  const canvasScale = renderer.canvas instanceof HTMLCanvasElement
    ? Number(renderer.canvas.dataset.cssScale)
    : Number.NaN;
  const evaluationOptions = renderer.backend === "skia"
    ? { time: renderTime }
    : Number.isFinite(canvasScale) && canvasScale > 0
    ? { time: renderTime, outputScale: canvasScale }
    : { time: renderTime };
  const hasAnimatedTracks = project.layers.some((layer) => (layer.tracks?.length ?? 0) > 0);
  const evaluated =
    usableFrameOverride ??
    (hasAnimatedTracks
      ? evaluateRuntimeProjectV3(compileProtocolAtTime(project, renderTime), frameIndex, evaluationOptions)
      : runtimeOverride
        ? evaluateRuntimeProjectV3(runtimeAtPreviewTime(project, runtimeOverride, renderTime), frameIndex, evaluationOptions)
      : evaluateRuntimeProjectV3(compileProtocol(project), frameIndex, evaluationOptions));
  if (requestId !== requestRef.current) return;
  const painted = applyStagePreviewOverrides(evaluated, previewOverrides);
  renderer.paintFrame(painted);
  // Consumers such as the editor text overlay need the current frame even
  // while a text layer is transitioning from unprepared to shaped. They can
  // inspect the command glyphs themselves; gating this callback by the whole
  // project's text-layer inventory leaves caret geometry stale or missing for
  // compositions with timed/inactive text layers.
  onFrameReady?.(painted);
  const rendererCanvas = renderer.canvas;
  if (rendererCanvas instanceof HTMLCanvasElement) {
    const stats = renderer.getStats();
    rendererCanvas.dataset.drawCalls = String(stats.drawCalls);
    rendererCanvas.dataset.runtimeFrame = String(evaluated.frame);
    rendererCanvas.dataset.runtimeTime = String(evaluated.time);
    const textCommands = evaluated.commands.filter((command) => command.op === "drawText");
    rendererCanvas.dataset.runtimeTextCommands = String(textCommands.length);
    rendererCanvas.dataset.runtimeGlyphs = String(textCommands.reduce((total, command) => total + (command.glyphs?.length ?? 0), 0));
    rendererCanvas.dataset.runtimeColorGlyphs = String(textCommands.reduce((total, command) => total + (command.glyphs?.filter((glyph) => glyph.colorGlyph)?.length ?? 0), 0));
    rendererCanvas.dataset.runtimeColorGlyphModes = [...new Set(textCommands.flatMap((command) => command.glyphs?.flatMap((glyph) => glyph.colorGlyph ? [glyph.colorGlyph.kind === "bitmap" ? `${glyph.colorGlyph.kind}:${glyph.colorGlyph.mimeType}` : glyph.colorGlyph.kind] : []) ?? []))].join(",");
    rendererCanvas.dataset.skiaNativeTextGlyphs = String(stats.nativeTextGlyphs ?? 0);
    rendererCanvas.dataset.skiaNativeColorTextGlyphs = String(stats.nativeColorTextGlyphs ?? 0);
    rendererCanvas.dataset.skiaOutlineTextGlyphs = String(stats.outlineTextGlyphs ?? 0);
    rendererCanvas.dataset.skiaColorTextGlyphs = String(stats.colorTextGlyphs ?? 0);
    rendererCanvas.dataset.skiaTextureUploads = String(stats.textureUploads ?? 0);
    rendererCanvas.dataset.skiaVideoTextureUploads = String(stats.videoTextureUploads ?? 0);
    rendererCanvas.dataset.skiaImageCacheHits = String(stats.imageCacheHits ?? 0);
    rendererCanvas.dataset.skiaFilterCacheHits = String(stats.filterCacheHits ?? 0);
    rendererCanvas.dataset.skiaMaskCacheHits = String(stats.maskCacheHits ?? 0);
    rendererCanvas.dataset.skiaProjectiveMeshCacheHits = String(stats.projectiveMeshCacheHits ?? 0);
    rendererCanvas.dataset.skiaOffscreenSurfaceCreates = String(stats.offscreenSurfaceCreates ?? 0);
    rendererCanvas.dataset.skiaOffscreenSurfaceReuses = String(stats.offscreenSurfaceReuses ?? 0);
    rendererCanvas.dataset.skiaImageCacheEntries = String(stats.imageCacheEntries ?? 0);
    rendererCanvas.dataset.skiaFilterCacheEntries = String(stats.filterCacheEntries ?? 0);
    rendererCanvas.dataset.skiaMaskCacheEntries = String(stats.maskCacheEntries ?? 0);
    rendererCanvas.dataset.skiaProjectiveMeshCacheEntries = String(stats.projectiveMeshCacheEntries ?? 0);
    rendererCanvas.dataset.skiaPooledSurfaceCount = String(stats.pooledSurfaceCount ?? 0);
    rendererCanvas.dataset.skiaEstimatedCacheBytes = String(stats.estimatedCacheBytes ?? 0);
    if (collectPerformanceMetrics) {
      const paintEndedAt = performance.now();
      const previousPaintAt = Number(rendererCanvas.dataset.paintAtMs);
      const previousWasPlaying = rendererCanvas.dataset.paintPlaying === "true";
      const paintIntervalMs = Number.isFinite(previousPaintAt)
        ? Math.max(0, paintStartedAt - previousPaintAt)
        : 0;
      const expectedFrameMs = 1000 / Math.max(1, project.composition.fps);
      const skipped = playing && previousWasPlaying
        ? Math.max(0, Math.round(paintIntervalMs / expectedFrameMs) - 1)
        : 0;
      const previousDropped = Number(rendererCanvas.dataset.estimatedDroppedFrames) || 0;
      rendererCanvas.dataset.gpuFrameTimeMs = stats.frameTimeMs.toFixed(2);
      rendererCanvas.dataset.previewPaintTimeMs = Math.max(0, paintEndedAt - paintStartedAt).toFixed(2);
      rendererCanvas.dataset.paintIntervalMs = paintIntervalMs.toFixed(2);
      rendererCanvas.dataset.estimatedDroppedFrames = String(previousDropped + skipped);
      rendererCanvas.dataset.paintAtMs = String(paintStartedAt);
      rendererCanvas.dataset.paintPlaying = String(playing);
    }
    rendererCanvas.dataset.videoTimes = evaluated.commands
      .filter((command) => command.op === "drawVideo")
      .map((command) => `${command.key}:${command.mediaTime.toFixed(3)}:${command.mediaVisible !== false ? "visible" : "hidden"}`)
      .join(",");
    const missingResourceDiagnostics = evaluated.commands
      .filter((command) => (command.op === "drawImage" || command.op === "drawVideo") && !assets.has(command.assetId))
      .map(() => ({ code: "preview_asset_missing" }));
    const backendDiagnostics = (stats.skippedCommands ?? 0) > 0
      ? stats.diagnostics
      : stats.diagnostics.filter((diagnostic) => !["skia_command_unsupported", "skia_replay_diagnostic"].includes(diagnostic.code));
    rendererCanvas.dataset.diagnostics = [
      ...evaluated.diagnostics,
      // Backend selection is a lifecycle info event, not a frame/render
      // diagnostic. Keep it out of the canvas contract so parity checks and
      // performance tooling only observe actionable issues.
      ...backendDiagnostics.filter((diagnostic) => diagnostic.code !== "preview_backend_selected"),
      ...preparationDiagnostics.map((code) => ({ code })),
      ...missingResourceDiagnostics,
    ]
      .map((diagnostic) => diagnostic.code)
      .join(",");
    if (collectPerformanceMetrics) {
      rendererCanvas.dataset.videoHealth = JSON.stringify(
        evaluated.commands.flatMap((command) => {
          if (command.op !== "drawVideo") return [];
          const asset = assets.get(command.assetId);
          if (!asset || !(asset.source instanceof HTMLVideoElement)) return [];
          const quality = asset.source.getVideoPlaybackQuality?.();
          return [{
            assetId: command.assetId,
            driftMs: Math.round((asset.source.currentTime - command.mediaTime) * 1000),
            readyState: asset.source.readyState,
            seeking: asset.source.seeking,
            paused: asset.source.paused,
            droppedVideoFrames: quality?.droppedVideoFrames ?? 0,
            totalVideoFrames: quality?.totalVideoFrames ?? 0,
          }];
        }),
      );
    }
  }
}

function previewSampleTimeAtEnd(
  project: ReturnType<typeof MotionProtocolV2Schema.parse>,
  time: number,
): number {
  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  const duration = project.layers.reduce(
    (end, layer) => Math.max(end, (layer.timing.start + layer.timing.duration) / 1000),
    0,
  );
  if (duration <= 0 || safeTime < duration) return safeTime;

  const lastFrame = Math.max(
    0,
    Math.ceil(duration * project.composition.fps) - 1,
  );
  return lastFrame / project.composition.fps;
}

function applyCanvasLayout(
  host: HTMLDivElement,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  devicePixelRatio: number,
  renderDpr: number,
): void {
  const scale = canvasCssScale(host, width, height);
  const targetCanvas = canvas;
  targetCanvas.style.width = `${width * scale}px`;
  targetCanvas.style.height = `${height * scale}px`;
  targetCanvas.style.transform = "translate(-50%, -50%)";
  targetCanvas.dataset.devicePixelRatio = String(devicePixelRatio);
  targetCanvas.dataset.logicalWidth = String(width);
  targetCanvas.dataset.logicalHeight = String(height);
  targetCanvas.dataset.backingWidth = String(targetCanvas.width);
  targetCanvas.dataset.backingHeight = String(targetCanvas.height);
  targetCanvas.dataset.cssScale = String(scale);
  targetCanvas.dataset.renderDpr = String(renderDpr);
}

function canvasCssScale(host: HTMLDivElement, width: number, height: number): number {
  return Math.max(0.08, Math.min(host.clientWidth / width, host.clientHeight / height));
}

function canvasRenderDpr(
  host: HTMLDivElement,
  width: number,
  height: number,
  devicePixelRatio: number,
  backend: PreviewStageBackendKind,
): number {
  // Skia renders the canonical composition surface once at 1920x1080. The
  // host only controls the CSS display size, so the browser performs the
  // final downsampling consistently with the native HTML reference.
  if (backend === "skia") return 1;
  return canvasCssScale(host, width, height) * devicePixelRatio;
}
