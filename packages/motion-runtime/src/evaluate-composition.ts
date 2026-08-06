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
  type CompositionSceneInput,
} from "./composition/evaluate-composition-layers";

function scenesForComposition(runtime: NormalizedMotionProjectV2): CompositionSceneInput[] {
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
  return evaluateCompositionLayers(scenesForComposition(runtime), globalTime, width, height);
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
  const target = resolveCompositionEvaluateTarget(runtime, frame, fps, sceneId, width, height);
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
    (evaluated as EvaluatedFrame & { compositionLayers?: CompositionFramePlan }).compositionLayers =
      target.layerPlan;
  }
  return evaluated;
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
  return (
    evaluateCompositionFrame(
      runtime,
      frame,
      fps,
      width,
      height,
      sceneId,
      background,
    )?.interaction ?? null
  );
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
  const duration = Math.max(1 / safeFps, total > 0 ? total : fallback > 0 ? fallback : 1);
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
