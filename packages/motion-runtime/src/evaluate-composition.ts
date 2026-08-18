import { ratioFromPercent } from "@motionvideo/motion-protocol";
import { frameIndexAtTime } from "./clock";
import type {
  MotionRuntimeProject,
  RuntimeLayerGraph,
} from "@motionvideo/motion-protocol/runtime";
import { timelineTotalDuration } from "./resolve-timeline";
import { evaluateFrame, type EvaluatedFrame } from "./evaluated-frame";
import type { RenderSnapshot } from "./render-snapshot";
import {
  compositionTotalDuration,
  evaluateCompositionLayers,
  type CompositionFramePlan,
  type LayerGraphSegmentInput,
} from "./composition/evaluate-composition-layers";
import {
  COMPOSITION_FRAME_CONTRACT_VERSION,
  stableLayerKey,
  type EvaluatedCompositionFrame,
  type EvaluatedLayer,
  type EvaluatedAudioState,
  type EvaluatedMediaState,
  type ProjectionSnapshot,
} from "./evaluated-composition-frame";
import type { PaintCommandBuffer } from "./paint";
import { cameraViewMatrix, type CameraViewParams } from "./camera-view";
import { IDENTITY_MATRIX } from "./matrix";
import { perspectiveMatrix, lookAtMatrix, matrix4ToArray } from "./matrix4";
import { throwIfAborted, cancelledDiagnostic } from "./cancellation";
import { RuntimeDiagnosticCollector, toRenderDiagnostic } from "./diagnostics";
import { isFeatureEnabled, FeatureFlag } from "./version-policy";
import {
  ROOT_LAYER_GRAPH_ID,
  audioLayersFromRuntime,
  layerGraphFromRuntime,
} from "./layer-graph";

function layerGraphsForComposition(
  runtime: MotionRuntimeProject,
): LayerGraphSegmentInput[] {
  const duration = runtime.timeline.duration;
  if (!(duration > 0)) return [];
  return [
    {
      graphId: ROOT_LAYER_GRAPH_ID,
      start: 0,
      duration,
      sourceDuration: duration,
      trackId: "visual",
      trackOrder: 0,
    },
  ];
}

export function planCompositionFrame(
  runtime: MotionRuntimeProject,
  globalTime: number,
  width: number,
  height: number,
): CompositionFramePlan {
  return evaluateCompositionLayers(
    layerGraphsForComposition(runtime),
    globalTime,
    width,
    height,
    runtime.metadata.fps,
  );
}

function resolveCompositionEvaluateTarget(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  graphId?: string,
  width = 1080,
  height = 1920,
): {
  scene: RuntimeLayerGraph;
  time: number;
  frame: number;
  layerPlan?: CompositionFramePlan;
} | null {
  const safeFps = Math.max(1, fps);
  const graph = layerGraphFromRuntime(runtime);

  if (graphId) {
    if (graph.layers.length === 0 && !(graph.duration > 0)) return null;
    return { scene: graph, time: frame / safeFps, frame };
  }

  const globalTime = frame / safeFps;
  const layerPlan = planCompositionFrame(runtime, globalTime, width, height);
  const primary = layerPlan.layers[layerPlan.layers.length - 1];
  if (primary) {
    const localFrame = Math.max(0, Math.round(primary.localTime * safeFps));
    return {
      scene: graph,
      time: primary.localTime,
      frame: localFrame,
      layerPlan,
    };
  }

  return null;
}

/**
 * Evaluate a composition frame into the shared {@link EvaluatedFrame} contract
 * (interaction snapshot + paint buffer + diagnostics).
 *
 * - When `graphId` is set: frame is local to that layer graph.
 * - When `graphId` is omitted: frame is global; empty timing windows yield no layers.
 *
 * @deprecated Use {@link evaluateCompositionFrameV1} which returns the richer
 *             {@link EvaluatedCompositionFrame} with layers, projection, audio, and media state.
 */
export function evaluateCompositionFrame(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  width: number,
  height: number,
  graphId?: string,
  background?: string,
): EvaluatedFrame | null {
  const target = resolveCompositionEvaluateTarget(
    runtime,
    frame,
    fps,
    graphId,
    width,
    height,
  );
  if (!target) return null;
  const assetUriById = new Map(
    runtime.assets.map((asset) => [asset.id, asset.uri] as const),
  );
  const evaluated = evaluateFrame({
    scene: target.scene,
    time: target.time,
    frame: target.frame,
    width,
    height,
    background,
    assetUriById,
  });
  if (target.layerPlan) {
    (
      evaluated as EvaluatedFrame & { compositionLayers?: CompositionFramePlan }
    ).compositionLayers = target.layerPlan;
  }
  return evaluated;
}

/**
 * Evaluate a composition frame into the new {@link EvaluatedCompositionFrame} contract.
 *
 * This is the canonical entrypoint for Phase 3+. It returns the full composition frame
 * with layers, projection, audio state, and media state — not just the scene-local snapshot.
 *
 * Options:
 *  - `stageView`: "camera" (default) uses the scene's active camera; "flat" ignores camera
 *     transform and renders in identity space (useful for editor flat preview).
 *  - `graphId`: local to a single scene; omit for global composition timeline.
 */
export function evaluateCompositionFrameV1(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  width: number,
  height: number,
  opts?: {
    graphId?: string;
    background?: string;
    /** Camera override — "flat" ignores camera transforms */
    stageView?: "camera" | "flat";
    /** Phase 12: Cancellation signal */
    signal?: AbortSignal;
    /** Phase 12: Feature flags for gradual rollout */
    featureFlags?: readonly string[];
  },
): EvaluatedCompositionFrame | null {
  const safeFps = Math.max(1, fps);
  const globalTime = frame / safeFps;
  const graphId = opts?.graphId;
  const background = opts?.background;
  const stageView = opts?.stageView ?? "camera";

  // Phase 12: Check cancellation before any work
  throwIfAborted(opts?.signal, "EVALUATION_CANCELLED");

  const collector = new RuntimeDiagnosticCollector({
    frame,
    time: globalTime,
    graphId: graphId,
  });

  const assetUriById = new Map(
    runtime.assets.map((asset) => [asset.id, asset.uri] as const),
  );

  // ── Layer plan ──────────────────────────────────────────────────
  // Boundary check uses the canonical runtime duration (explicit
  // timeline.duration, falling back to max visual end) so manual tail frames
  // are not truncated.
  const totalDuration = timelineTotalDuration(runtime);
  if (globalTime < 0 || globalTime >= totalDuration) return null;

  const layerPlan = evaluateCompositionLayers(
    layerGraphsForComposition(runtime),
    globalTime,
    width,
    height,
    runtime.metadata.fps,
  );

  if (layerPlan.layers.length === 0) return null;

  // ── Evaluate each layer ─────────────────────────────────────────
  const layers: EvaluatedLayer[] = [];
  const sceneCache = new Map<string, RuntimeLayerGraph>();
  const graph = layerGraphFromRuntime(runtime);
  sceneCache.set(ROOT_LAYER_GRAPH_ID, graph);

  for (let i = 0; i < layerPlan.layers.length; i++) {
    // Phase 12: Periodically check cancellation during layer evaluation
    throwIfAborted(opts?.signal, "EVALUATION_CANCELLED");

    const layer = layerPlan.layers[i]!;
    const scene = sceneCache.get(layer.graphId) ?? graph;

    const localFrame = Math.max(0, Math.round(layer.localTime * safeFps));
    const evaluated = evaluateFrame({
      scene,
      time: layer.localTime,
      frame: localFrame,
      width,
      height,
      background,
      assetUriById,
    });

    // Generate stable keys for each drawable
    const iterIdx = layerPlan.layers
      .filter((l) => l.graphId === layer.graphId)
      .indexOf(layer);
    const layerKey = stableLayerKey(
      layer.graphId,
      `layer_${i}`,
      iterIdx > 0 ? iterIdx : undefined,
    );

    layers.push({
      layerKey,
      graphId: layer.graphId,
      layerId: `composition_layer_${i}`,
      composition: layer,
      interaction: evaluated.interaction,
      paint: evaluated.paint,
    });
  }

  // ── Compute perspective projection early (needed for 3D frame evaluation) ─
  const primaryScene =
    layers.length > 0
      ? (sceneCache.get(layers[layers.length - 1]!.graphId) ?? null)
      : null;
  const perspectiveProjection = resolvePerspectiveProjection(
    primaryScene,
    width,
    height,
  );

  // Now re-evaluate any layers that need the projection wired into paint
  // (perspective-3d scenes only — other spaces don't need it)
  if (perspectiveProjection) {
    for (const layer of layers) {
      throwIfAborted(opts?.signal, "EVALUATION_CANCELLED");
      const scene = sceneCache.get(layer.graphId);
      if (!scene || (scene.space ?? "flat-2d") !== "perspective-3d") continue;
      const localFrame = Math.max(
        0,
        Math.round(layer.composition.localTime * safeFps),
      );
      const reEvaluated = evaluateFrame({
        scene,
        time: layer.composition.localTime,
        frame: localFrame,
        width,
        height,
        background,
        assetUriById,
        perspectiveProjection: {
          viewMatrix: perspectiveProjection.viewMatrix,
          projectionMatrix: perspectiveProjection.projectionMatrix,
        },
      });
      layer.paint = reEvaluated.paint;
    }
  }

  // ── Combined interaction (last layer wins for hit-test) ────────
  const combinedInteraction =
    layers.length > 0 ? layers[layers.length - 1]!.interaction : null;

  // ── Combined paint (merge all layer buffers) ────────────────────
  const allCommands = layers.flatMap((l) => l.paint.commands);
  const combinedPaint: PaintCommandBuffer = {
    commands: allCommands,
    diagnostics: layers.flatMap((l) => l.paint.diagnostics),
  };

  // ── Projection ──────────────────────────────────────────────────
  const projection = buildProjection(
    primaryScene,
    combinedInteraction,
    stageView,
    width,
    height,
  );

  // ── Audio state ─────────────────────────────────────────────────
  const audio = buildAudioState(runtime, globalTime);

  // ── Media state ─────────────────────────────────────────────────
  const media = buildMediaState(layers, runtime);

  // ── All diagnostics ─────────────────────────────────────────────
  // Merge paint diagnostics with runtime collector diagnostics
  const paintDiagnostics = layers.flatMap((l) => l.paint.diagnostics);
  const runtimeDiagnostics = collector.diagnostics.map(toRenderDiagnostic);
  const allDiagnostics = [...paintDiagnostics, ...runtimeDiagnostics];

  // Phase 12: record cancellation diagnostic if signal was aborted
  if (opts?.signal?.aborted) {
    allDiagnostics.push(
      toRenderDiagnostic(
        cancelledDiagnostic("EVALUATION_CANCELLED", {
          frame,
          time: globalTime,
          graphId,
        }),
      ),
    );
  }

  // Phase 12: Feature-flag awareness — skip perspective-3d if flag not enabled
  const effectiveProjection = isFeatureEnabled(FeatureFlag.PERSPECTIVE_3D, opts)
    ? projection
    : projection.kind === "perspective-3d"
      ? { kind: "orthographic-2d" as const, viewMatrix: IDENTITY_MATRIX }
      : projection;

  return {
    contractVersion: COMPOSITION_FRAME_CONTRACT_VERSION,
    compositionFrame: frame,
    compositionTime: globalTime,
    fps: safeFps,
    viewport: { width, height },
    layers,
    interaction: combinedInteraction ??
      layers[0]?.interaction ?? {
        graphId: ROOT_LAYER_GRAPH_ID,
        frame,
        time: globalTime,
        width,
        height,
        space: "flat-2d",
        projection: { kind: "orthographic" },
        cameraMatrix: IDENTITY_MATRIX,
        items: [],
      },
    paint: combinedPaint,
    audio,
    media,
    projection: effectiveProjection,
    diagnostics: allDiagnostics,
  };
}

export function evaluateCompositionSnapshot(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  width: number,
  height: number,
  graphId?: string,
  background?: string,
): RenderSnapshot | null {
  const v1 = evaluateCompositionFrameV1(runtime, frame, fps, width, height, {
    graphId,
    background,
  });
  return v1?.interaction ?? null;
}

// ── Projection helpers ────────────────────────────────────────────────

/**
 * Compute perspective 3D projection from scene camera config.
 * Returns null for non-perspective-3d scenes.
 * This is a scene-only projection — doesn't depend on evaluated frames.
 */
function resolvePerspectiveProjection(
  scene: RuntimeLayerGraph | null,
  width: number,
  height: number,
): { viewMatrix: number[]; projectionMatrix: number[] } | null {
  if (!scene) return null;
  if ((scene.space ?? "flat-2d") !== "perspective-3d") return null;
  if (!scene.activeCameraLayerId) return null;
  const cameraNode = scene.layers.find(
    (n) => n.id === scene.activeCameraLayerId,
  );
  if (!cameraNode || cameraNode.type !== "camera") return null;

  const aspect = width / height;
  const fov = cameraNode.payload.fov ?? 60;
  const near = cameraNode.payload.near ?? 0.1;
  const far = cameraNode.payload.far ?? 10000;
  const projMat = perspectiveMatrix(fov, aspect, near, far);

  // Camera at origin with look direction along -Z
  const rotX = cameraNode.payload.rotationX ?? 0;
  const rotY = cameraNode.payload.rotationY ?? 0;
  const pitchRad = (rotX * Math.PI) / 180;
  const yawRad = (rotY * Math.PI) / 180;
  const camX = cameraNode.transform.translate.x;
  const camY = cameraNode.transform.translate.y;
  const camZ = cameraNode.transform.depth;
  const lookTarget = [
    camX + Math.sin(yawRad) * Math.cos(pitchRad),
    camY + Math.sin(pitchRad),
    camZ - Math.cos(yawRad) * Math.cos(pitchRad),
  ];
  const viewMat = lookAtMatrix(
    camX,
    camY,
    camZ,
    lookTarget[0]!,
    lookTarget[1]!,
    lookTarget[2]!,
    0,
    1,
    0,
  );

  return {
    viewMatrix: matrix4ToArray(viewMat),
    projectionMatrix: matrix4ToArray(projMat),
  };
}

function buildProjection(
  scene: RuntimeLayerGraph | null,
  interaction: RenderSnapshot | null,
  stageView: "camera" | "flat",
  width: number,
  height: number,
): ProjectionSnapshot {
  const space = scene?.space ?? "flat-2d";

  if (stageView === "flat" || space === "flat-2d") {
    return {
      kind: "orthographic-2d",
      viewMatrix: IDENTITY_MATRIX,
    };
  }

  // layered-2.5d: apply camera view if activeCamera is set
  if (scene?.activeCameraLayerId && interaction) {
    const cameraNode = interaction.items.find(
      (n) => n.layerId === scene.activeCameraLayerId,
    );
    if (cameraNode) {
      const cam: CameraViewParams = {
        x: cameraNode.worldMatrix.e,
        y: cameraNode.worldMatrix.f,
        zoom: 1,
        rotation: 0,
      };
      const viewMat = cameraViewMatrix(cam, width, height);
      return {
        kind: "layered-2.5d",
        viewMatrix: viewMat,
        depthPolicy: "painter-order",
      };
    }
  }

  // perspective-3d: compute 4×4 view + projection matrices from active camera
  if (space === "perspective-3d" && scene?.activeCameraLayerId && interaction) {
    const cameraNode = interaction.items.find(
      (n) => n.layerId === scene.activeCameraLayerId,
    );
    if (cameraNode && cameraNode.worldMatrix4) {
      const sceneNode = scene.layers.find(
        (n) => n.id === scene.activeCameraLayerId,
      );
      if (sceneNode?.type === "camera") {
        const aspect = width / height;
        const fov = sceneNode.payload.fov ?? 60;
        const near = sceneNode.payload.near ?? 0.1;
        const far = sceneNode.payload.far ?? 10000;
        // Build perspective projection matrix (WebGL NDC convention)
        const projMat = perspectiveMatrix(fov, aspect, near, far);
        // Build view matrix from camera position/orientation
        const rotX = sceneNode.payload.rotationX ?? 0;
        const rotY = sceneNode.payload.rotationY ?? 0;
        // Camera position from worldMatrix translation
        const camX = cameraNode.worldMatrix.e;
        const camY = cameraNode.worldMatrix.f;
        const camZ =
          ((sceneNode.transform as unknown as Record<string, unknown>)
            .z as number) ?? 0;
        // Camera look direction: rotate (0,0,-1) by rotX/rotY
        const pitchRad = (rotX * Math.PI) / 180;
        const yawRad = (rotY * Math.PI) / 180;
        const lookTarget = [
          camX + Math.sin(yawRad) * Math.cos(pitchRad),
          camY + Math.sin(pitchRad),
          camZ - Math.cos(yawRad) * Math.cos(pitchRad),
        ];
        const viewMat = lookAtMatrix(
          camX,
          camY,
          camZ,
          lookTarget[0]!,
          lookTarget[1]!,
          lookTarget[2]!,
          0,
          1,
          0,
        );
        return {
          kind: "perspective-3d",
          viewMatrix: matrix4ToArray(viewMat),
          projectionMatrix: matrix4ToArray(projMat),
          near,
          far,
          focalLengthPx: height / 2 / Math.tan(((fov / 2) * Math.PI) / 180),
        };
      }
    }
  }

  return {
    kind: "orthographic-2d",
    viewMatrix: IDENTITY_MATRIX,
  };
}

// ── Audio state helper ────────────────────────────────────────────────

function buildAudioState(
  runtime: MotionRuntimeProject,
  globalTime: number,
): EvaluatedAudioState {
  const assetDurationById = new Map(
    runtime.assets
      .filter((a) => a.assetType === "audio")
      .map((a) => [a.id, (a as { duration?: number }).duration ?? 0]),
  );

  const tracks = audioLayersFromRuntime(runtime).map((layer) => {
    const payload = layer.payload;
    const start = layer.timing.start;
    const duration = layer.timing.duration;
    const trimStart = payload.trimStart ?? 0;
    const assetDuration = assetDurationById.get(payload.assetId) ?? 0;
    const localTime = Math.max(0, globalTime - start + trimStart);
    const volume = Math.min(
      1,
      Math.max(0, ratioFromPercent(payload.volume ?? 100)),
    );
    const fadeInEnd = payload.fadeIn ?? 0;
    const fadeOutStart = duration - (payload.fadeOut ?? 0);
    const clipLocal = globalTime - start;
    const muted = payload.muted ?? false;
    const fadeActive =
      clipLocal >= 0 &&
      clipLocal < duration &&
      (((payload.fadeIn ?? 0) > 0 && clipLocal < fadeInEnd) ||
        ((payload.fadeOut ?? 0) > 0 && clipLocal > fadeOutStart));

    return {
      trackId: layer.id,
      assetId: payload.assetId,
      mediaTime: localTime,
      volume: muted ? 0 : volume,
      muted,
      fadeActive,
      assetDuration,
    };
  });

  return { tracks };
}

// ── Media state helper ────────────────────────────────────────────────

function buildMediaState(
  layers: EvaluatedLayer[],
  runtime: MotionRuntimeProject,
): EvaluatedMediaState[] {
  const mediaStates: EvaluatedMediaState[] = [];
  const assetUriById = new Map(runtime.assets.map((a) => [a.id, a.uri]));

  for (const layer of layers) {
    for (const node of layer.interaction.items) {
      if (node.nodeType !== "video" && node.nodeType !== "image") continue;

      const sceneNode = runtime.layers.find((n) => n.id === node.layerId);

      mediaStates.push({
        layerId: node.layerId,
        mediaTime: layer.composition.localTime,
        // Use composition fps from the runtime metadata (fallback 30)
        sourceFrame: Math.round(
          layer.composition.localTime *
            ((runtime.metadata as { fps?: number }).fps ?? 30),
        ),
        assetId:
          (sceneNode as { payload?: { assetId?: string } })?.payload?.assetId ??
          node.layerId,
        uri: (sceneNode as { payload?: { assetId?: string } })?.payload?.assetId
          ? assetUriById.get(
              (sceneNode as { payload?: { assetId?: string } }).payload!
                .assetId!,
            )
          : undefined,
        playbackRate: 1,
        active: true,
      });
    }
  }

  return mediaStates;
}

export function compositionDurationInFrames(
  runtime: MotionRuntimeProject,
  graphId?: string,
  fps = 30,
): number {
  const safeFps = Math.max(1, fps);
  if (graphId) {
    const graph = layerGraphFromRuntime(runtime);
    if (graph.layers.length === 0 && !(graph.duration > 0))
      return Math.max(1, safeFps);
    const duration = Math.max(1 / safeFps, graph.duration || 1);
    return Math.max(
      1,
      frameIndexAtTime(duration, safeFps) || Math.ceil(duration * safeFps),
    );
  }

  const total = compositionTotalDuration(layerGraphsForComposition(runtime));
  const fallback = timelineTotalDuration(runtime);
  const derivedDuration = total > 0 ? total : fallback > 0 ? fallback : 1;
  // An explicit timeline.duration is the authoritative final MP4 length. It
  // may exceed the derived content end (intentional empty tail) but never be
  // shorter (enforced by the compiler / canonical schema).
  const declaredDuration = runtime.timeline.duration;
  const duration = Math.max(
    1 / safeFps,
    declaredDuration !== undefined && declaredDuration > 0
      ? declaredDuration
      : derivedDuration,
  );
  return Math.max(
    1,
    frameIndexAtTime(duration, safeFps) || Math.ceil(duration * safeFps),
  );
}

export {
  evaluateCompositionLayers,
  compositionTotalDuration,
  type CompositionFramePlan,
  type CompositionLayerPlan,
  type LayerGraphSegmentInput,
  type CompositionLayerInput,
} from "./composition/evaluate-composition-layers";
