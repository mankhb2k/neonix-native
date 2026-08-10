import { type RenderSnapshot } from "./render-snapshot";
import { frameIndexAtTime } from "./clock";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "./resolve-timeline";
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

function scenesForComposition(
  runtime: NormalizedMotionProjectV2,
): CompositionSceneInput[] {
  const byId = new Map(runtime.scenes.map((scene) => [scene.id, scene]));
  const order =
    runtime.timeline.sceneOrder.length > 0
      ? runtime.timeline.sceneOrder
      : runtime.scenes.map((scene) => scene.id);
  return order
    .map((id) => byId.get(id))
    .filter((scene): scene is NonNullable<typeof scene> => scene != null)
    .map((scene) => ({
      sceneId: scene.id,
      duration: scene.duration,
      transition: scene.transition as CompositionSceneInput["transition"],
    }));
}

export function planCompositionFrame(
  runtime: NormalizedMotionProjectV2,
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
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  sceneId?: string,
  width = 1080,
  height = 1920,
): {
  scene: NormalizedMotionProjectV2["scenes"][number];
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

  const resolved = resolveTimelineAtTime(runtime, globalTime);
  if (!resolved) return null;
  const scene = runtime.scenes.find((s) => s.id === resolved.sceneId);
  if (!scene) return null;
  const localFrame = Math.max(0, Math.round(resolved.localTime * safeFps));
  return { scene, time: resolved.localTime, frame: localFrame, layerPlan };
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
  runtime: NormalizedMotionProjectV2,
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
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  width: number,
  height: number,
  opts?: {
    sceneId?: string;
    background?: string;
    /** Camera override — "flat" ignores camera transforms */
    stageView?: "camera" | "flat";
  },
): EvaluatedCompositionFrame | null {
  const safeFps = Math.max(1, fps);
  const globalTime = frame / safeFps;
  const sceneId = opts?.sceneId;
  const background = opts?.background;
  const stageView = opts?.stageView ?? "camera";

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
  const sceneCache = new Map<
    string,
    NormalizedMotionProjectV2["scenes"][number]
  >();

  for (let i = 0; i < layerPlan.layers.length; i++) {
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
  const primaryScene =
    layers.length > 0
      ? sceneCache.get(layers[layers.length - 1]!.sceneId)
      : null;

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
  const diagnostics = layers.flatMap((l) => l.paint.diagnostics);

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
    projection,
    diagnostics,
  };
}

export function evaluateCompositionSnapshot(
  runtime: NormalizedMotionProjectV2,
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

// ── Projection helper ─────────────────────────────────────────────────

function buildProjection(
  scene: NormalizedMotionProjectV2["scenes"][number] | null,
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

  return {
    kind: "orthographic-2d",
    viewMatrix: IDENTITY_MATRIX,
  };
}

// ── Audio state helper ────────────────────────────────────────────────

function buildAudioState(
  runtime: NormalizedMotionProjectV2,
  globalTime: number,
): EvaluatedAudioState {
  const tracks = (runtime.timeline.audioTracks ?? []).map((track) => {
    const start = track.start ?? 0;
    const trimStart = track.trimStart ?? 0;
    const duration = 1; // simplified — full impl in Phase 7
    const localTime = Math.max(0, globalTime - start + trimStart);
    const volume = Math.min(1, Math.max(0, track.volume ?? 1));
    const fadeInEnd = track.fadeIn ?? 0;
    const fadeOutStart = duration - (track.fadeOut ?? 0);
    const fadeActive =
      (track.fadeIn && localTime < fadeInEnd) ||
      (track.fadeOut && localTime > fadeOutStart);

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
  runtime: NormalizedMotionProjectV2,
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
        sourceFrame: Math.round(layer.composition.localTime * 30),
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
  runtime: NormalizedMotionProjectV2,
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
