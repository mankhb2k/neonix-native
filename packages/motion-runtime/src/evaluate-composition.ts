import { type RenderSnapshot } from "./render-snapshot";
import { frameIndexAtTime } from "./clock";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";
import { timelineTotalDuration } from "./resolve-timeline";
import { evaluateFrame, type EvaluatedFrame } from "./evaluated-frame";
import {
  compositionTotalDuration,
  evaluateCompositionLayers,
  type CompositionFramePlan,
  type CompositionLayerPlan,
  type CompositionSceneInput,
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
import {
  IDENTITY_MATRIX4,
  perspectiveMatrix,
  lookAtMatrix,
  matrix4ToArray,
} from "./matrix4";
import { throwIfAborted, cancelledDiagnostic } from "./cancellation";
import {
  RuntimeDiagnosticCollector,
  RuntimeDiagnosticCode,
  createDiagnostic,
  toRenderDiagnostic,
  type RuntimeDiagnostic,
} from "./diagnostics";
import { isFeatureEnabled, FeatureFlag } from "./version-policy";

function scenesForComposition(
  runtime: MotionRuntimeProject,
): CompositionSceneInput[] {
  // Phase 7: visualTracks primary track is the sole source of scene ordering.
  // Clip-level transitionOut carries per-scene transitions directly.
  const primaryTrack = runtime.timeline.visualTracks.find(
    (t) => t.role === "primary",
  );
  if (!primaryTrack || primaryTrack.clips.length === 0) {
    return [];
  }
  const sortedClips = [...primaryTrack.clips].sort((a, b) => a.start - b.start);
  return sortedClips.map((clip) => {
    const sourceId =
      clip.source.kind === "scene"
        ? clip.source.sceneId
        : clip.source.componentId;
    return {
      sceneId: sourceId,
      duration: clip.duration,
      transition: clip.transitionOut as CompositionSceneInput["transition"],
    };
  });
}

export function planCompositionFrame(
  runtime: MotionRuntimeProject,
  globalTime: number,
  width: number,
  height: number,
): CompositionFramePlan {
  return evaluateCompositionLayers(
    scenesForComposition(runtime),
    globalTime,
    width,
    height,
  );
}

function resolveCompositionEvaluateTarget(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  sceneId?: string,
  width = 1080,
  height = 1920,
): {
  scene: MotionRuntimeProject["scenes"][number];
  time: number;
  frame: number;
  layerPlan?: CompositionFramePlan;
} | null {
  const safeFps = Math.max(1, fps);

  if (sceneId) {
    const scene =
      runtime.scenes.find((candidate) => candidate.id === sceneId) ??
      runtime.scenes[0];
    if (!scene) return null;
    return { scene, time: frame / safeFps, frame };
  }

  const globalTime = frame / safeFps;
  const layerPlan = planCompositionFrame(runtime, globalTime, width, height);
  const primary = layerPlan.layers[layerPlan.layers.length - 1];
  if (primary) {
    const scene = runtime.scenes.find((s) => s.id === primary.sceneId);
    if (!scene) return null;
    const localFrame = Math.max(0, Math.round(primary.localTime * safeFps));
    return { scene, time: primary.localTime, frame: localFrame, layerPlan };
  }

  // Phase 7: composition layers are resolved exclusively from visualTracks.
  // When no layers match (e.g. empty timeline), return null.
  return null;
}

/**
 * Evaluate a composition frame into the shared {@link EvaluatedFrame} contract
 * (interaction snapshot + paint buffer + diagnostics).
 *
 * - When `sceneId` is set: frame is local to that scene.
 * - When `sceneId` is omitted: frame is global; transition overlaps use the shared layer plan.
 *
 * @deprecated Use {@link evaluateCompositionFrameV3} which returns the richer
 *             {@link EvaluatedCompositionFrame} with layers, projection, audio, and media state.
 */
export function evaluateCompositionFrame(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  width: number,
  height: number,
  sceneId?: string,
  background?: string,
): EvaluatedFrame | null {
  const target = resolveCompositionEvaluateTarget(
    runtime,
    frame,
    fps,
    sceneId,
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
 *  - `sceneId`: local to a single scene; omit for global composition timeline.
 */
export function evaluateCompositionFrameV3(
  runtime: MotionRuntimeProject,
  frame: number,
  fps: number,
  width: number,
  height: number,
  opts?: {
    sceneId?: string;
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
  const sceneId = opts?.sceneId;
  const background = opts?.background;
  const stageView = opts?.stageView ?? "camera";

  // Phase 12: Check cancellation before any work
  throwIfAborted(opts?.signal, "EVALUATION_CANCELLED");

  const collector = new RuntimeDiagnosticCollector({
    frame,
    time: globalTime,
    sceneId: sceneId,
  });

  const assetUriById = new Map(
    runtime.assets.map((asset) => [asset.id, asset.uri] as const),
  );

  // ── Layer plan ──────────────────────────────────────────────────
  const totalDuration = compositionTotalDuration(
    scenesForComposition(runtime),
    width,
    height,
  );
  if (globalTime < 0 || globalTime >= totalDuration) return null;

  const layerPlan = evaluateCompositionLayers(
    scenesForComposition(runtime),
    globalTime,
    width,
    height,
  );

  if (layerPlan.layers.length === 0) return null;

  // ── Evaluate each layer ─────────────────────────────────────────
  const layers: EvaluatedLayer[] = [];
  const sceneCache = new Map<string, MotionRuntimeProject["scenes"][number]>();

  for (let i = 0; i < layerPlan.layers.length; i++) {
    // Phase 12: Periodically check cancellation during layer evaluation
    throwIfAborted(opts?.signal, "EVALUATION_CANCELLED");

    const layer = layerPlan.layers[i]!;
    let scene = sceneCache.get(layer.sceneId);
    if (!scene) {
      scene = runtime.scenes.find((s) => s.id === layer.sceneId);
      if (scene) sceneCache.set(layer.sceneId, scene);
    }
    if (!scene) continue;

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
      .filter((l) => l.sceneId === layer.sceneId)
      .indexOf(layer);
    const layerKey = stableLayerKey(
      layer.sceneId,
      `layer_${i}`,
      iterIdx > 0 ? iterIdx : undefined,
    );

    layers.push({
      layerKey,
      sceneId: layer.sceneId,
      nodeId: `composition_layer_${i}`,
      composition: layer,
      interaction: evaluated.interaction,
      paint: evaluated.paint,
    });
  }

  // ── Compute perspective projection early (needed for 3D frame evaluation) ─
  const primaryScene =
    layers.length > 0
      ? sceneCache.get(layers[layers.length - 1]!.sceneId)
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
      const scene = sceneCache.get(layer.sceneId);
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
          sceneId,
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
    interaction:
      combinedInteraction ??
      layers[0]?.interaction ??
      ({
        sceneId: "",
        time: globalTime,
        items: [],
        width,
        height,
      } as RenderSnapshot),
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
  sceneId?: string,
  background?: string,
): RenderSnapshot | null {
  const v3 = evaluateCompositionFrameV3(runtime, frame, fps, width, height, {
    sceneId,
    background,
  });
  return v3?.interaction ?? null;
}

// ── Projection helpers ────────────────────────────────────────────────

/**
 * Compute perspective 3D projection from scene camera config.
 * Returns null for non-perspective-3d scenes.
 * This is a scene-only projection — doesn't depend on evaluated frames.
 */
function resolvePerspectiveProjection(
  scene: MotionRuntimeProject["scenes"][number] | null,
  width: number,
  height: number,
): { viewMatrix: number[]; projectionMatrix: number[] } | null {
  if (!scene) return null;
  if ((scene.space ?? "flat-2d") !== "perspective-3d") return null;
  if (!scene.activeCameraId) return null;
  const cameraNode = scene.nodes.find((n) => n.id === scene.activeCameraId);
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
  const camX = cameraNode.transform.x;
  const camY = cameraNode.transform.y;
  const camZ =
    ((cameraNode.transform as unknown as Record<string, unknown>)
      .z as number) ?? 0;
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
  scene: MotionRuntimeProject["scenes"][number] | null,
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
  if (scene?.activeCameraId && interaction) {
    const cameraNode = interaction.items.find(
      (n) => n.nodeId === scene.activeCameraId,
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
  if (space === "perspective-3d" && scene?.activeCameraId && interaction) {
    const cameraNode = interaction.items.find(
      (n) => n.nodeId === scene.activeCameraId,
    );
    if (cameraNode && cameraNode.worldMatrix4) {
      const sceneNode = scene.nodes.find((n) => n.id === scene.activeCameraId);
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

  const tracks = (runtime.timeline.audioTracks ?? []).map((track) => {
    const start = track.start ?? 0;
    const trimStart = track.trimStart ?? 0;
    const assetDuration = assetDurationById.get(track.assetId) ?? 0;
    const localTime = Math.max(0, globalTime - start + trimStart);
    const volume = Math.min(1, Math.max(0, track.volume ?? 1));
    const fadeInEnd = track.fadeIn ?? 0;
    const fadeOutStart = assetDuration - (track.fadeOut ?? 0);
    const fadeActive =
      ((track.fadeIn ?? 0) > 0 && localTime < fadeInEnd) ||
      ((track.fadeOut ?? 0) > 0 && localTime > fadeOutStart);

    return {
      trackId: track.id,
      assetId: track.assetId,
      mediaTime: localTime,
      volume,
      muted: false,
      fadeActive,
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

      const scene = runtime.scenes.find((s) => s.id === layer.sceneId);
      const sceneNode = scene?.nodes.find((n) => n.id === node.nodeId);

      mediaStates.push({
        nodeId: node.nodeId,
        mediaTime: layer.composition.localTime,
        // Use composition fps from the runtime metadata (fallback 30)
        sourceFrame: Math.round(
          layer.composition.localTime *
            ((runtime.metadata as { fps?: number }).fps ?? 30),
        ),
        assetId:
          (sceneNode as { payload?: { assetId?: string } })?.payload?.assetId ??
          node.nodeId,
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
  sceneId?: string,
  fps = 30,
): number {
  const safeFps = Math.max(1, fps);
  if (sceneId) {
    const scene =
      runtime.scenes.find((candidate) => candidate.id === sceneId) ??
      runtime.scenes[0];
    if (!scene) return Math.max(1, safeFps);
    const duration = Math.max(1 / safeFps, scene.duration ?? 1);
    return Math.max(
      1,
      frameIndexAtTime(duration, safeFps) || Math.ceil(duration * safeFps),
    );
  }

  const total = compositionTotalDuration(scenesForComposition(runtime));
  const fallback = timelineTotalDuration(runtime);
  const duration = Math.max(
    1 / safeFps,
    total > 0 ? total : fallback > 0 ? fallback : 1,
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
  type CompositionSceneInput,
  type CompositionTransition,
} from "./composition/evaluate-composition-layers";
